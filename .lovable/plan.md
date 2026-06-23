# Plano: Cria Aí como Oficina Criativa interna da Solidare Hub

O escopo enviado é amplo (28 seções). Para entregar com qualidade, sem IA paga, e sem quebrar o que já existe (Laboratório, Banco de Ideias, Calendário, Aprovação, Biblioteca, PDF, PWA), proponho dividir em **5 fases**. Cada fase é autônoma, testável e mantém o app utilizável ao final.

Confirme quais fases ativar e em qual ordem. Posso começar pela Fase 1 imediatamente.

---

## Fase 1 — Novo ponto de entrada e Briefing Progressivo
**Seções:** 1, 2, 3, 6, 23

- Nova tela ao clicar em **Criar conteúdo** com 4 caminhos: Sem ideias / Tenho tema / Adaptar / Campanha completa.
- Fluxo "Sem ideias": só pede marca + opcional (objetivo, período, quantidade) e gera cards usando o `brandIdeaSources` já existente, expandido.
- Fluxo "Tenho tema": pede marca + tema + objetivo opcional → mostra **caminhos editoriais** (educativo, inspirador, comercial, relacionamento, etc.) com prévia de título antes de desenvolver.
- Briefing progressivo no wizard atual: 3 etapas (essencial → desenvolvimento → avançado), tudo editável, nada escondido permanentemente.
- Tela inicial (`app.index`) ganha os 4 atalhos novos + bloco "Em que etapa estão meus conteúdos?".

**Arquivos principais:** `src/routes/_authenticated/app.content.new.tsx` (refactor), nova rota `app.create.tsx` (hub), `app.index.tsx`, `src/lib/creativePaths.ts` (novo).

---

## Fase 2 — Banco de Caminhos Criativos + Matriz Objetivo × Caminho + Mapa Criativo
**Seções:** 7, 8, 9, 12

- `src/lib/creativePathsLibrary.ts` (novo): biblioteca determinística de ~20 caminhos com objetivos compatíveis, focos, formatos, estrutura, CTAs sugeridos, regras anti-repetição. Aproveita o `ideaCompatibility.ts` existente.
- Tela **Mapa Criativo** antes de gerar peças: ideia central, objetivo, público, tensão, promessa, ângulo, tom, CTA, diferencial, formato — todos editáveis com botão "Trocar caminho criativo" (preserva conteúdo salvo).
- Editor de Orientações por peça: o que destacar / evitar / sensação / info obrigatória / CTA / observação livre.

**Arquivos principais:** `src/lib/creativePathsLibrary.ts`, `src/components/creative-map.tsx`, integração em `app.content.$projectId.result.tsx`.

---

## Fase 3 — Construtor de Peças + Variações Determinísticas + Campos Protegidos
**Seções:** 10, 11, 13, 15, 17

- Construtor de peças com campos editáveis sempre visíveis (função, título, apoio, bullets, CTA, foco visual, observações, prompt final). Ações: editar, duplicar, remover, reordenar, criar variação, trocar função/ângulo, regenerar prompt, aprovar copy.
- **Variações sem IA**: mais direta / curta / acolhedora / educativa / comercial / inspiradora / institucional / conversacional — usando modelos editoriais internos (`src/lib/copyVariations.ts`).
- **Campos protegidos**: cadeado por campo; variações respeitam o que está travado.
- **CTA contextual** por objetivo/canal (`src/lib/ctaIntelligence.ts`).
- **Biblioteca de aberturas** (`src/lib/openingTemplates.ts`): pergunta, erro, lista, desejo, contraste, curiosidade.

**Arquivos principais:** `src/components/piece-builder.tsx` (expande o atual), `src/lib/copyVariations.ts`, `src/lib/ctaIntelligence.ts`, `src/lib/openingTemplates.ts`.

---

## Fase 4 — Motor Anti-Repetição + Modo Adaptar + Pacote Multiformato + Campanha Completa
**Seções:** 4, 5, 14, 18

- `src/lib/copyDiversity.ts` (novo ou expansão): detecta repetição em títulos, CTAs, benefícios, diferenciais, frases, aberturas — com limites: mesmo CTA em no máx 2 campanhas recentes, mesmo diferencial em no máx 2 peças do projeto, mesma abertura em no máx 1 peça por campanha. Diferenciais viram **opções**, não conteúdo obrigatório.
- **Modo Adaptar**: seleciona projeto/ideia/peça anterior → transforma formato (Feed→Stories, Carrossel→Status, Reel→Carrossel) ou cria nova abordagem, preservando tema/fatos/identidade e variando estrutura/gancho/CTA/ângulo.
- **Modo Campanha completa**: ideia central → canais → formatos → **mapa da campanha** com função diferente por peça (carrossel explica, story interage, status reforça, post resume).
- **Pacote multiformato**: a partir de uma ideia aprovada, sugere adaptações compatíveis com função própria.

**Arquivos principais:** `src/lib/copyDiversity.ts`, novas rotas `app.adapt.tsx` e `app.campaign.tsx`, `src/lib/campaignMap.ts`.

---

## Fase 5 — Repertório da Marca + Status de Criação + Revisão pré-prompt + Biblioteca/Filtros + Despriorizar Aprovação
**Seções:** 16, 19, 20, 21, 22, 24, 25, 27

- Marca ganha aba **Repertório criativo**: temas prioritários, produtos, serviços, dúvidas, dores, benefícios aprovados, diferenciais, histórias, bastidores, datas, CTAs permitidos, CTAs saturados, expressões recomendadas/evitar, formatos preferidos, referências visuais. Alimenta Laboratório e Construtor (sem copiar literalmente).
- **Status internos** de criação (ideia → estrutura → copy em construção → copy revisão → prompt pronto → arte pendente → arte anexada → pronto p/ calendário → agendado → publicado). Distintos da aprovação do cliente.
- **Prévia da campanha** com fluxo Ideia→Estrutura→Copy→Prompt→Arte→Calendário.
- **Revisão pré-prompt**: valida título, apoio, CTA, objetivo, termos proibidos, repetição, tamanho, info obrigatória, placeholders. Bloqueia só: info obrigatória ausente, termo proibido, frase quebrada, dado inventado, placeholder.
- **Ponte ChatGPT externa** (manter o que já existe, deixar opcional).
- **Biblioteca**: filtros por fase criativa, caminho, objetivo, formato, marca, status, adaptado, campanha; card mostra título, marca, caminho, formatos, fase, atualização.
- **Despriorizar visualmente** o portal de aprovação (mantém funcional, sai do destaque na Home/Dashboard).
- **Migração SQL**: novos campos em `brands` (repertório), em `content_projects` (creation_status, creative_path, campaign_id, parent_project_id para adaptação).

**Arquivos principais:** `src/components/brand-form.tsx`, `src/lib/creationStatus.ts`, `src/components/campaign-preview.tsx`, `src/lib/prePromptReview.ts` (expansão de copyQuality), `app.library.tsx`, `app.index.tsx`, migração Supabase.

---

## Decisões técnicas transversais (válidas para todas as fases)

- **Sem IA paga**: tudo determinístico via libs em `src/lib/`. Mantém o caminho "Revisar no ChatGPT" externo, opcional.
- **Compatibilidade total**: nada apagado. Laboratório, Banco de Ideias, Calendário, Aprovação, Biblioteca, PDF, RLS, PWA, temas — todos preservados.
- **Tipagem**: cada lib nova com tipos exportados; reuso de `ideaTaxonomy`, `ideaCompatibility`, `promptBuilder`, `copyComposer`, `copyQuality`, `brandIdeaSources` já existentes.
- **Mobile + dark**: cada nova tela testada nos dois modos.
- **Migração de dados**: novos campos sempre `nullable` com default seguro; mapeamento de status antigos.

---

## Como prosseguir

Responda com uma destas opções:

1. **"Fase 1"** — começo só pela Fase 1 (entry point + briefing progressivo + sem ideias + tenho tema).
2. **"Fases 1+2"** — entry point + caminhos criativos + mapa criativo.
3. **"Tudo, por fases"** — implemento Fase 1 agora e aguardo seu OK entre fases.
4. **Outra ordem** — diga qual combinação prefere (ex.: "Fase 1 + Fase 3", "começa pelo Repertório da marca").

Qual ativar?
