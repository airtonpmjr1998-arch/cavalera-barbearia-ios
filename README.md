# Cavalera Barbearia — iOS / iPhone / iPad

Este projeto cria uma versão nativa iOS da Cavalera Barbearia usando:

- SwiftUI
- WKWebView
- Google Apps Script como aplicação web
- GitHub Actions
- TestFlight / App Store Connect

O aplicativo abre a mesma URL `/exec` usada no Android.

## O que já está pronto

- iPhone
- iPad
- layout responsivo
- WKWebView com cookies e JavaScript
- WhatsApp abre fora do app
- Google Maps abre fora do app
- navegação interna do Apps Script permanece dentro do app
- tela de carregamento
- tela de erro / tentar novamente
- ícone Cavalera
- launch screen Cavalera
- workflow para validar o projeto
- workflow para gerar IPA e enviar ao TestFlight

Bundle ID usado:

`br.com.cavalerabarbearia.ios`

## Importante sobre iOS

Para instalar um aplicativo nativo em iPhone através do TestFlight ou publicar na App Store,
é necessária uma assinatura ativa do Apple Developer Program.

Sem assinatura, ainda é possível validar a compilação no GitHub,
mas não é possível gerar um IPA de distribuição instalável pelo TestFlight.

## Estrutura

```text
.github/
  workflows/
    validar-ios.yml
    testflight.yml

CavaleraBarbearia/
  Assets.xcassets/
  AppConfiguration.swift
  CavaleraBarbeariaApp.swift
  CavaleraWebView.swift
  ContentView.swift
  LaunchScreen.storyboard
  WebViewModel.swift

webapp-atual/
  Codigo.gs
  Index.html

project.yml
README.md
.gitignore
```

## Etapa 1 — Criar o repositório

Recomendação:

`cavalera-barbearia-ios`

Envie todo o conteúdo deste ZIP preservando as pastas.

## Etapa 2 — Criar WEB_APP_URL

No GitHub:

`Settings > Secrets and variables > Actions > Variables`

Crie:

Nome:
`WEB_APP_URL`

Valor:
a URL pública do Google Apps Script terminando em `/exec`.

## Etapa 3 — Validar sem Apple Developer

Vá em:

`Actions > iOS - Validar projeto > Run workflow`

Esse workflow compila para o simulador e confirma que o projeto está correto.

Ele não gera um aplicativo instalável em um iPhone físico.

## Etapa 4 — Apple Developer

Para TestFlight, é necessário:

1. Apple Developer Program ativo
2. App ID / Bundle ID:
   `br.com.cavalerabarbearia.ios`
3. App criado no App Store Connect
4. App Store Connect API Key de equipe
5. Team ID

## Etapa 5 — Variáveis do GitHub para TestFlight

Em:

`Settings > Secrets and variables > Actions > Variables`

Crie:

`WEB_APP_URL`
`APPLE_TEAM_ID`
`APPSTORE_KEY_ID`
`APPSTORE_ISSUER_ID`

Em:

`Settings > Secrets and variables > Actions > Secrets`

Crie:

`APPSTORE_API_PRIVATE_KEY`

O valor desse Secret deve ser o conteúdo completo do arquivo `.p8`
baixado ao criar a chave no App Store Connect.

Nunca envie o `.p8` para o repositório.

## Etapa 6 — Enviar ao TestFlight

Vá em:

`Actions > iOS - Enviar TestFlight > Run workflow`

O workflow:

1. gera o projeto Xcode
2. arquiva o app
3. assina usando a Apple
4. exporta o IPA
5. valida o IPA
6. envia ao TestFlight
7. disponibiliza uma cópia do IPA como Artifact do GitHub

Após o upload, o build passa pelo processamento do App Store Connect
antes de aparecer no TestFlight.

## Atualizações futuras

Enquanto a URL `/exec` for a mesma, alterações no seu:

- Index.html
- Codigo.gs
- layout
- animações
- serviços
- horários

aparecem no app sem precisar gerar outro IPA.

Um novo IPA será necessário quando houver alteração nativa,
por exemplo:

- ícone
- nome
- bundle ID
- Swift
- permissões
- versão nativa
