# Catálogo técnico de baterias

O configurador só mostra uma bateria como compatível quando existe uma
**aplicação** cadastrada (veículo → bateria) com **fonte** informada.
Sem aplicação confirmada, o visitante é encaminhado ao especialista pelo
WhatsApp com os dados do veículo já preenchidos.

Arquivo: `public/data/catalog.json` (ou o endpoint em `VITE_CATALOG_URL`).
Hoje ele está **vazio** de propósito — nenhum produto foi inventado.

## Formato

```jsonc
{
  "schemaVersion": 1,
  "updatedAt": "2026-10-21",               // data da última revisão do catálogo
  "source": "Tabela de aplicação do fabricante X, edição 2026",
  "batteries": [
    {
      "id": "fabricante-modelo-60",         // único, sem espaços
      "manufacturer": "Nome do fabricante",
      "model": "Código do modelo",
      "capacityAh": 60,                     // obrigatório
      "cca": 480,                           // ou null se o fabricante não informa
      "dimensionsMm": { "length": 242, "width": 175, "height": 175 }, // ou null
      "polarity": "direita",                // "direita" | "esquerda" | null (lado do polo positivo)
      "technology": "Convencional",         // ex.: Convencional, EFB, AGM
      "applicationNote": "Texto curto opcional",
      "warrantyMonths": 12,                 // só se a garantia estiver confirmada; senão null
      "image": { "src": "/img/produtos/x.webp", "width": 800, "height": 800, "alt": "..." }, // ou null
      "price": { "amountBRL": 499.9, "updatedAt": "2026-10-20" },  // ou null
      "stock": { "available": true, "updatedAt": "2026-10-21" },   // ou null
      "source": "Ficha técnica do fabricante"   // obrigatório
    }
  ],
  "applications": [
    {
      "make": "Fiat",
      "model": "Argo",
      "yearFrom": 2017,
      "yearTo": 2024,
      "engine": "1.3",                      // null = vale para todas as motorizações
      "startStop": false,                   // true/false se o cadastro distingue; senão null
      "batteryIds": ["fabricante-modelo-60"],
      "source": "Catálogo de aplicação do fabricante, pág. 12",   // obrigatório
      "verifiedAt": "2026-10-21"
    }
  ]
}
```

## Regras aplicadas pelo site

| Regra | Comportamento |
| --- | --- |
| Item sem `source`, sem `capacityAh` ou com bateria inexistente | Ignorado (aviso no console), nunca exibido |
| Mesmo veículo com motorizações diferentes e motorização não informada | Pede a motorização; não escolhe sozinho |
| Cadastro distingue start-stop e o cliente responde "não sei" | Mostra as opções com aviso para confirmar |
| Preço com `updatedAt` há mais de 15 dias | Preço oculto |
| Estoque com `updatedAt` há mais de 2 dias | Disponibilidade oculta |
| Nenhuma aplicação | Painel "validação especializada" + WhatsApp |

Os limites ficam em `src/catalog/catalog.js` (`PRICE_MAX_AGE_DAYS`, `STOCK_MAX_AGE_DAYS`).

## Lista de veículos do formulário

`public/data/vehicles.json` é só uma lista de referência de marcas e modelos
para facilitar o preenchimento. Ela **não indica compatibilidade**. Modelos
que aparecem em `applications` são adicionados automaticamente à lista.

## Testar com dados fictícios

Em desenvolvimento (`npm run dev`), abra `http://localhost:5173/?catalogo=teste`.
O site carrega `tests/fixtures/catalog.test.json` e mostra uma faixa
"DADOS FICTÍCIOS DE TESTE". Esse arquivo nunca entra no build de produção.
