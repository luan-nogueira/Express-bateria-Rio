# Express Baterias Rio — site

Site institucional e comercial da Express Baterias Rio: hero com bateria 3D,
consulta de bateria por veículo, serviços, conteúdo técnico, avaliações,
contato e conversão pelo WhatsApp.

Site estático (sem servidor): HTML semântico + CSS próprio + JavaScript
modular, empacotado com Vite. Substitui o site atual em WordPress/Elementor.

## Executar

Requer Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes de regras (catálogo e WhatsApp)
npm run build      # gera dist/ para publicação
npm run preview    # serve o dist/ em http://localhost:4173
```

Regenerar as imagens otimizadas (requer Python + Pillow):
`npm run images` — lê `assets-originais/` e grava em `public/`.

## Publicar

`npm run build` gera a pasta `dist/`, com arquivos estáticos que funcionam em qualquer hospedagem.

- **Hospedagem atual (Apache/cPanel):** envie o conteúdo de `dist/` para `public_html/`.
  O `.htaccess` incluído configura a página 404, o cache e cabeçalhos de segurança.
  Faça backup do WordPress antes de substituir.
- **GitHub Pages (prévia):** cada push na `main` publica automaticamente em
  https://luan-nogueira.github.io/Express-bateria-Rio/ (workflow em `.github/workflows/deploy.yml`).
  Essa versão sai com `noindex`, para não concorrer no Google com o domínio oficial.
  Ativação, uma vez só: *Settings → Pages → Build and deployment → Source: GitHub Actions*.
- **Outra hospedagem estática:** comando de build `npm run build`, pasta de saída `dist`.
  Para servir numa subpasta, defina `BASE_PATH=/subpasta/` no build.

Depois da troca, confira no Google Search Console o `sitemap.xml` e a propriedade do domínio.

## Painel administrativo

Endereço: `/admin.html` (na prévia: https://luan-nogueira.github.io/Express-bateria-Rio/admin.html).

- **O que faz:** cadastro de baterias, das aplicações por veículo (marca, modelo, anos, motorização, start-stop) e dos tipos de bateria. Valida tudo com as mesmas regras do site e publica.
- **Login:** e-mail e senha conferidos por um hash PBKDF2 em `src/admin/credentials.js`. Nem o e-mail nem a senha ficam no código. Para trocar: `node scripts/admin-senha.mjs <email> <nova-senha>`, depois commit e push.
- **Publicação:** exige um token *fine-grained* do GitHub com **Contents: Read and write** apenas neste repositório. O token fica salvo só no navegador de quem publica. Cada publicação é um commit nas planilhas `catalogo/*.csv`, e o GitHub Actions valida e atualiza o site em cerca de 1 minuto.
- **Rascunho:** as alterações ficam salvas no navegador até serem publicadas.
- **Limite de segurança:** em site estático o login roda no navegador. Ele esconde o painel, mas quem protege os dados é o token. Sem token ninguém altera o site. Para um painel com várias pessoas e permissões, o próximo passo é um serviço com autenticação no servidor.

## Variáveis de ambiente

Copie `.env.example` para `.env`. Nenhuma é secreta (todas vão para o navegador).

| Variável | Uso |
| --- | --- |
| `VITE_GTM_ID` | Google Tag Manager. Opcional. Só carrega após o consentimento de cookies. O site atual usa `GTM-KHSJ6MBS`. Confirme com quem gerencia os anúncios. |
| `VITE_CATALOG_URL` | Endpoint do catálogo de baterias. Opcional. Padrão: `data/catalog.json` do próprio site. |
| `BASE_PATH` | Só no build: subpasta onde o site é servido. Padrão `/`. |
| `NOINDEX` | Só no build: `1` adiciona `noindex` (para prévias). |

## Arquitetura

```
index.html                 página principal (conteúdo e SEO no HTML)
privacidade.html, 404.html
public/                    arquivos servidos como estão (imagens, dados, robots, sitemap)
  data/catalog.json        catálogo técnico (vazio até ser preenchido — ver docs/CATALOGO.md)
  data/vehicles.json       lista de marcas/modelos do formulário
src/
  config/business.js       dados comerciais (telefone, endereço, avaliações, promessas)
  catalog/catalog.js       regras de compatibilidade (puro, testável)
  catalog/repository.js    carregamento e validação dos dados
  lib/whatsapp.js          links e mensagens contextuais do WhatsApp
  three/batteryScene.js    bateria 3D procedural (Three.js, carregada sob demanda)
  hero/heroVisual.js       decide entre 3D e ilustração estática
  ui/*                     configurador, resultados, cabeçalho, animações, consentimento
  styles/                  tokens do design system, base, componentes, seções
tests/                     testes de regras + catálogo fictício de teste
docs/CATALOGO.md           formato e regras do catálogo
```

Decisões principais:

- **Sem framework.** O site é uma página de conteúdo com poucas interações, e o JavaScript principal tem cerca de 33 KB (gzip).
- **Three.js só na hero.** É carregado depois que a página fica pronta, em um arquivo separado de cerca de 140 KB (gzip).
  - A bateria é um modelo procedural, sem download de arquivo 3D.
  - O modelo é conceitual: não imita nenhum produto ou marca real.
  - Alternativa estática em SVG: aparece sem WebGL, com economia de dados ou em aparelhos limitados.
  - Com movimento reduzido, a bateria aparece parada.
  - O 3D é pausado fora da tela e reduz a qualidade sozinho se o aparelho não sustentar a animação. No celular roda a 30 fps.
- **Motion** (biblioteca `motion`) para as animações de entrada e os contadores. Nada fica escondido se o JavaScript falhar.
- **Nenhum dado inventado.**
  - O configurador nunca indica uma bateria sem aplicação cadastrada com fonte.
  - Preço e estoque só aparecem quando estão atualizados.
  - Não há depoimentos fictícios nem integração simulada com o Google.
- **Privacidade.** Nenhum script de terceiros é carregado sem consentimento. O mapa é uma ilustração com link para o Google Maps, sem iframe.

## Dados comerciais

Ao mudar telefone, endereço, nota do Google ou promessas comerciais, atualize:

1. `src/config/business.js`
2. o texto correspondente em `index.html` (fica no HTML para SEO), o bloco JSON-LD no `<head>` e `public/llms.txt`

As promessas abaixo foram confirmadas pela empresa em 21/10/2026: chegada em até 30 min, entrega e instalação grátis, até 10x sem juros, há 10 anos no Rio e cobertura de orçamento mais barato.

## Pendências (dependem de dados externos)

- **Catálogo de baterias:** preencher `catalogo/baterias.csv` e `catalogo/aplicacoes.csv` (abrem no Excel) com dados de fabricantes ou fornecedores e rodar `npm run catalogo` (ver `docs/CATALOGO.md`). Enquanto estiver vazio, toda consulta vai para o especialista pelo WhatsApp.
- **Fotos de produtos** para os cards de resultado.
- **Depoimentos reais**, com autorização dos clientes. A seção de avaliações mostra só a nota, o total e os destaques informados.
- **CNPJ / razão social** para o rodapé e a política de privacidade.
- **Google Tag Manager / Google Ads:** definir `VITE_GTM_ID` e configurar no GTM os eventos `whatsapp_click`, `phone_click`, `maps_click` e `battery_search`.
- **Leads do programa de parceria Moura:** o site antigo enviava os leads do formulário para uma API externa. Isso exige um token secreto, e um site estático não pode guardar segredos. Se essa integração precisar continuar, crie uma função de servidor (serverless) que guarde o token em variável de ambiente.
- **Segurança do site antigo:** o HTML público do WordPress atual expõe um trecho de código com um token de acesso dessa API. Recomenda-se revogar e trocar esse token.

## Testes

- `npm test`: 22 testes de regras (validação do catálogo, motorização, start-stop, preços desatualizados, importação das planilhas, mensagens e codificação do WhatsApp).
- Testes de interface (Playwright, executados durante o desenvolvimento): 62 verificações no site e 24 no painel (login, cadastro, validação, rascunho e publicação com o GitHub simulado).
  - Formulário: validação, campos dependentes, estados de carregamento, resultado, sem resultado e erro com nova tentativa, mensagem do WhatsApp.
  - Celular: menu, ausência de rolagem horizontal, alvos de toque, botão flutuante.
  - Movimento reduzido, navegador sem WebGL, links e arquivos públicos.
