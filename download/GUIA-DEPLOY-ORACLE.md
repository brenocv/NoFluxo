# Guia de Deploy — Oracle Cloud Free Tier (Grátis para sempre)

Este guia te leva do zero ao app online com link próprio, HTTPS grátis e PWA instalável no celular.

---

## Pré-requisitos

- Conta de e-mail
- Cartão de crédito (para verificação — **não é cobrado**)
- 30 minutos de tempo

---

## Passo 1: Criar conta na Oracle Cloud

1. Acesse: https://www.oracle.com/cloud/free/
2. Clique em **"Start for free"**
3. Crie a conta com seu e-mail
4. Escolha a região mais próxima (ex: **São Paulo** ou **Ashburn**)
5. Adicione o cartão de crédito (verificação — não cobra)
6. Aguarde o e-mail de confirmação (pode levar até 1h)

> **Importante**: anote seu **tenancy OCID** e **usuário OCID** que aparecem no console.

---

## Passo 2: Criar a VM (instância Always Free)

1. No console da Oracle (cloud.oracle.com), vá em **Compute → Instances**
2. Clique em **"Create Instance"**
3. Configure:
   - **Name**: `porto-financas`
   - **Image**: Canonical Ubuntu 22.04 (ou 24.04)
   - **Shape**: `VM.Standard.A1.Flex` (ARM, grátis)
     - OCPUs: **4**
     - Memory: **24 GB**
   - **SSH Keys**: clique em **"Save private key"** e **"Save public key"**
     - Guarde esses arquivos com a sua vida! São sua única forma de acessar a VM.
   - **VNIC**: deixe padrão
4. Em **"Advanced options" → "Boot volume"**, deixe padrão (47 GB grátis)
5. Clique em **"Create"**

Aguarde 2-3 minutos até o status ficar **"Running"**.

> **Anote o IP público** que aparece na instância (ex: `150.230.XX.XX`)

---

## Passo 3: Configurar firewall (abrir portas)

### 3a. No console da Oracle (security list)

1. Vá em **Networking → Virtual Cloud Networks**
2. Clique na VCN padrão (ex: `vcn-...`)
3. Clique em **Security Lists** → **Default Security List**
4. Clique em **"Add Ingress Rules"**:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: `TCP`
   - Destination Port Range: `80,443,3000,3003`
5. Salve

### 3b. Na VM (iptables)

Conecte na VM via SSH:

```bash
# No seu computador (Linux/Mac) ou usando PuTTY (Windows)
ssh -i <caminho-da-chave-privada> ubuntu@<IP-DA-VM>
```

Dentro da VM, rode:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3003 -j ACCEPT
sudo netfilter-persistent save
```

---

## Passo 4: Instalar dependências na VM

Ainda dentro da VM via SSH:

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Instalar PM2 (gerenciador de processos - mantém o app rodando)
sudo npm install -g pm2

# Instalar Caddy (proxy reverso com HTTPS automático)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# Instalar git
sudo apt install -y git
```

---

## Passo 5: Subir o código do app

### Opção A: Via Git (recomendado)

1. Crie um repositório privado no GitHub
2. Faça upload do conteúdo do ZIP para o repositório
3. Na VM:

```bash
cd /home/ubuntu
git clone https://github.com/seu-usuario/porto-financas.git
cd porto-financas
```

### Opção B: Via SCP (upload direto)

No seu computador:

```bash
scp -i <chave-privada> -r porto-finance-app/* ubuntu@<IP-DA-VM>:/home/ubuntu/porto-financas/
```

---

## Passo 6: Instalar e configurar o app

Dentro da VM, na pasta do projeto:

```bash
cd /home/ubuntu/porto-financas

# Instalar dependências
bun install

# Gerar Prisma client
bun run db:generate

# Criar o banco de dados
bun run db:push

# Build de produção
bun run build

# Importar dados da planilha (se tiver o arquivo)
# Coloque o arquivo Porto 2026.xlsx em upload/
bun run scripts/seed.ts
```

---

## Passo 7: Configurar PM2 (manter rodando 24/7)

```bash
# Iniciar o Next.js
pm2 start "bun run start" --name "porto-app"

# Iniciar o Socket.io (mini-service)
cd mini-services/finance-sync
bun install
pm2 start "bun run index.ts" --name "porto-sync"
cd /home/ubuntu/porto-financas

# Salvar configuração do PM2 (reinicia automaticamente após reboot)
pm2 save
pm2 startup
# Ele vai mostrar um comando para rodar. Copie e cole esse comando.
```

---

## Passo 8: Configurar domínio grátis (DuckDNS)

### 8a. Criar domínio no DuckDNS

1. Acesse: https://www.duckdns.org
2. Faça login com Google/GitHub
3. Crie um subdomínio (ex: `porto-financas`)
4. Anote o token e o domínio: `porto-financas.duckdns.org`
5. Atualize o IP para o IP público da sua VM

### 8b. Configurar auto-atualização do DuckDNS

Na VM:

```bash
mkdir -p ~/duckdns
cat > ~/duckdns/duck.sh << 'EOF'
echo url="https://www.duckdns.org/update?domains=porto-financas&token=SEU-TOKEN-AQUI&ip=" | curl -k -o ~/duckdns/duck.log -K -
EOF
chmod 700 ~/duckdns/duck.sh

# Testar
~/duckdns/duck.sh
cat ~/duckdns/duck.log
# Deve mostrar "OK"

# Adicionar ao crontab (atualiza a cada 5 min)
crontab -e
# Adicione esta linha:
*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1
```

---

## Passo 9: Configurar Caddy (HTTPS automático)

Edite o arquivo do Caddy:

```bash
sudo nano /etc/caddy/Caddyfile
```

Apague tudo e cole:

```
porto-financas.duckdns.org {
    reverse_proxy localhost:3000

    # WebSocket support (Socket.io)
    @websocket {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    reverse_proxy @websocket localhost:3000
}

# Socket.io direto (para clientes que conectam na porta 3003)
:3003 {
    reverse_proxy localhost:3003
}
```

Salve (Ctrl+O, Enter, Ctrl+X) e reinicie o Caddy:

```bash
sudo systemctl restart caddy
sudo systemctl enable caddy
```

O Caddy vai automaticamente:
- Gerar certificado HTTPS (Let's Encrypt) grátis
- Renovar automaticamente a cada 3 meses
- Fazer proxy do tráfego para o Next.js (porta 3000)

---

## Passo 10: Testar!

No navegador, acesse:

```
https://porto-financas.duckdns.org
```

Se tudo deu certo, você verá o app rodando com:
- ✅ Cadeado verde (HTTPS)
- ✅ Funcionando no celular
- ✅ Sincronização em tempo real

---

## Passo 11: Instalar como app no celular (PWA)

### Android (Chrome)
1. Abra `https://porto-financas.duckdns.org` no Chrome
2. Menu (⋮) → **"Adicionar à tela inicial"**
3. Pronto! Ícone aparece como um app nativo

### iPhone (Safari)
1. Abra `https://porto-financas.duckdns.org` no Safari
2. Toque no botão compartilhar (□↑)
3. **"Adicionar à Tela de Início"**
4. Pronto!

---

## Manutenção

### Verificar se o app está rodando
```bash
pm2 status
```

### Ver logs
```bash
pm2 logs porto-app
pm2 logs porto-sync
```

### Reiniciar manualmente
```bash
pm2 restart porto-app
pm2 restart porto-sync
```

### Atualizar o código (após mudanças)
```bash
cd /home/ubuntu/porto-financas
git pull
bun install
bun run db:push
bun run build
pm2 restart porto-app
```

### Backup automático
Faça backup JSON pelo botão Database → Exportar pelo menos 1x por semana.
Para backup automático do banco:
```bash
# Adicionar ao crontab — backup diário às 3h da manhã
0 3 * * * cp /home/ubuntu/porto-financas/db/custom.db /home/ubuntu/backup/custom-$(date +\%Y\%m\%d).db
```

---

## Resumo

| Item | Custo |
|------|-------|
| Oracle Cloud VM (4 cores, 24GB RAM) | **Grátis** |
| DuckDNS (domínio) | **Grátis** |
| Let's Encrypt (HTTPS) | **Grátis** |
| PWA no celular | **Grátis** |
| **Total mensal** | **R$ 0,00** |

O app fica online 24/7, reinicia sozinho após restart da VM, tem HTTPS, e pode ser instalado como app no celular de vocês dois.

---

## Suporte

Se algo der errado, verifique:
1. `pm2 status` — os dois processos devem estar "online"
2. `sudo systemctl status caddy` — deve estar "active (running)"
3. Acesse pelo IP direto: `http://<IP-DA-VM>:3000` (sem HTTPS, para isolar problemas)
4. Logs: `pm2 logs` e `sudo journalctl -u caddy -f`
