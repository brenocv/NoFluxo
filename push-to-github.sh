#!/bin/bash
# Script para fazer push do projeto completo para o GitHub
# Execute: bash push-to-github.sh

set -e

echo "=== Push do projeto para GitHub ==="
echo ""
echo "Repo: https://github.com/brenocv/porto-finance"
echo ""

# Verifica se o remote existe
cd /home/z/my-project

if ! git remote get-url origin &>/dev/null; then
  git remote add origin https://github.com/brenocv/porto-finance.git
fi

echo "=== Arquivos que serão enviados ==="
echo "Total de arquivos no git: $(git ls-files | wc -l)"
echo "Arquivos src/: $(git ls-files src/ | wc -l)"
echo "Arquivos prisma/: $(git ls-files prisma/ | wc -l)"
echo "Arquivos scripts/: $(git ls-files scripts/ | wc -l)"
echo ""

echo "=== Últimos commits ==="
git log --oneline -3
echo ""

echo "=== Para fazer o push, você precisa configurar autenticação no GitHub ==="
echo ""
echo "Opção 1: Usar Personal Access Token (PAT)"
echo "  1. Acesse: https://github.com/settings/tokens"
echo "  2. Generate new token (classic) → marque 'repo'"
echo "  3. Copie o token"
echo "  4. Execute:"
echo "     git push --force https://<SEU_TOKEN>@github.com/brenocv/porto-finance.git main"
echo ""
echo "Opção 2: Usar GitHub CLI"
echo "  1. Instale: sudo apt install gh (ou brew install gh)"
echo "  2. Faça login: gh auth login"
echo "  3. Execute: git push --force origin main"
echo ""
echo "Opção 3: Configurar credenciais"
echo "  git config --global credential.helper store"
echo "  git push --force origin main"
echo "  (vai pedir usuário e senha/token)"
