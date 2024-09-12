git checkout main
git pull origin main
git checkout -b test-presence-feature

# Faça as alterações e commits

git add .
git commit -m "Implementa verificação de usuários na sala e set user_id"
git push origin test-presence-feature

# Testar localmente e depois mesclar

git checkout main
git pull origin main
git merge test-presence-feature
git push origin main
git branch -d test-presence-feature
git push origin --delete test-presence-feature # Opcional
