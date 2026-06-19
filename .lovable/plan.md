# Etapa "Desenvolver conteúdo com ChatGPT"

Vou adicionar uma nova etapa entre o Briefing e a geração das peças, com três caminhos: preenchimento manual, pedido para ChatGPT (cópia/colagem) ou rascunho automático. Sem chamadas a IA.

## Arquivos novos

- `src/lib/campaignDevelopment.ts` — tipos `CampaignContent`, `DevelopmentStatus`, `ContentSource`; helpers de prioridade de fontes, merge seletivo, sanitização.
- `src/lib/externalPrompt.ts` — `buildExternalCampaignPrompt(...)` (prompt enxuto p/ ChatGPT) e `parseCampaignJSON(raw)` (aceita markdown fences, valida estrutura, sanitiza strings, sem eval/HTML).
- `src/components/develop-content-step.tsx` — UI da etapa: 3 caminhos, campos editáveis, chips de diferenciais (auto moderado / nenhum / manual), "evitar nesta campanha", botões Copiar / Copiar+abrir ChatGPT / Importar resposta / Voltar.
- `src/components/import-campaign-dialog.tsx` — textarea + validação + prévia lado-a-lado (atual vs importado) com seleção de campos e peças, proteção de campos editados manualmente, aplicar/cancelar.
- `supabase/migrations/<ts>_campaign_development.sql` — colunas em `content_projects` (`content_development_status`, `content_source`, `campaign_content_json jsonb`, `imported_at timestamptz`, `selected_differentiators text[]`, `avoid_terms text[]`) e em `content_outputs` (`source text`, `imported_content jsonb`, `copy_status text`, `version int`). GRANTs preservados.

## Arquivos alterados

- `src/routes/_authenticated/app.content.new.tsx` — inserir a etapa "Desenvolver conteúdo" entre Briefing (4) e Pacote (5); salvar `campaign_content_json`, status e source.
- `src/lib/promptBuilder.ts` — nova prioridade de fontes: `external_chatgpt` > manual > projeto > ideia > briefing > tom da marca > diferenciais gerais. Diferenciais gerais viram **contexto**, não conteúdo obrigatório. Respeitar `avoid_terms` e `selected_differentiators` ao montar copy, legendas e prompts visuais. Para carrossel numerado, manter a inteligência já existente quando houver promessa numérica.
- `src/lib/copyComposer.ts` — quando houver `imported_content`, usar como fonte primária; não reinjetar diferenciais institucionais ("atendimento humano", "orçamento", "suporte") salvo se selecionados.
- `src/lib/copyQuality.ts` — adicionar verificação de termos bloqueados (`avoid_terms`) ao avaliar copy.
- `src/routes/_authenticated/app.content.$projectId.result.tsx` — mostrar selo "Fonte da copy: ChatGPT externo / Gerador automático"; botão por peça "Preparar revisão no ChatGPT" (somente aquela peça + resumo das demais); manter restaurar versão e histórico.
- `src/integrations/supabase/types.ts` — regenerar para refletir novas colunas.

## Estrutura do prompt externo

Cabeçalho fixo + blocos: MARCA, PROJETO, TEMA, OBJETIVO, FORMATOS, PÚBLICO RESUMIDO (≤25 palavras), TOM (≤25), CONTEXTO (ideia+briefing resumidos), DIFERENCIAIS DISPONÍVEIS, DIFERENCIAIS SELECIONADOS, EVITAR, INFORMAÇÕES OBRIGATÓRIAS, RESTRIÇÕES. Regras: não usar diferenciais como assunto principal, não repetir atendimento humano/suporte/orçamento salvo se selecionados. Pede JSON puro no schema abaixo.

## Estrutura do JSON aceito

```
{
  "campaign": { angle, central_message, main_promise, main_pain, main_benefit,
                audience_desires[], key_points[], selected_differentiators[],
                terms_to_avoid[], commercial_intensity, cta_strategy,
                main_cta, narrative_structure, visual_focus },
  "pieces": [ { id, format, role, objective, angle, headline, support_text,
                bullets[], cta, visual_focus, continuity_note, warnings[] } ],
  "caption": { text, hashtags[] },
  "warnings": []
}
```

`pieces` reflete os formatos selecionados (1 por página de carrossel, 1 por Status, 1 por tela de sequência, blocos para Reel).

## Importação e prévia

`parseCampaignJSON`: tira ```json fences, `JSON.parse`, valida tipos, limita tamanhos, sanitiza strings (sem HTML/scripts). Prévia mostra "atual vs importado" com checkboxes por campo e por peça. Campos com `manuallyEdited=true` vêm desmarcados com aviso "substituir edição manual?". Botões: Aplicar selecionados / Aplicar tudo / Cancelar.

## Prioridade efetiva no promptBuilder

1. peça importada (`pieces[i]`)  
2. campos manuais da campanha  
3. dados do projeto  
4. ideia do Laboratório  
5. briefing  
6. tom/regras da marca  
7. diferenciais gerais (somente como contexto disponível)

`avoid_terms` é aplicado como filtro final em copy, legenda, hashtags e prompts visuais.

## Status

`content_development_status`: `draft_auto | awaiting_development | imported | manually_reviewed | approved`.  
`content_source`: `auto | manual | external_chatgpt`.

## Segurança

RLS por `user_id` herdada de `content_projects`/`content_outputs`. Sanitização cliente + tipos validados. Sem `eval`, sem `dangerouslySetInnerHTML`.

## Testes manuais

Pedido gerado a partir de projeto do Laboratório; copiar; abrir ChatGPT; importar JSON puro e em bloco; JSON inválido; estrutura parcial; aplicar tudo / só campos / só peças; preservar edição manual; carrossel "5 pontos"; Status WhatsApp; Sequência de Stories; restaurar versão; mobile; RLS.

## Preservado

Auth, marcas, Laboratório, Banco de Ideias, TagsInput, matriz de entregas, carrosséis individualizados, biblioteca, PWA, temas, responsividade, prompts anteriores.
