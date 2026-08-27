# Cria Aí Studio

Crie uma aplicação web responsiva e instalável como PWA chamada “Cria Aí — Estúdio de Conteúdo”.

OBJETIVO DO APLICATIVO

O aplicativo será um estúdio de conteúdo multimarcas. Ele deve ajudar o usuário a cadastrar diferentes empresas, preencher briefings de divulgação e gerar prompts profissionais para criação de conteúdos de redes sociais.

Nesta primeira fase, o aplicativo NÃO deve gerar imagens e NÃO deve realizar chamadas para APIs de inteligência artificial.

A geração do resultado deve funcionar por meio de modelos de texto determinísticos, variáveis e regras implementadas no código. Dessa forma, o usuário poderá copiar o prompt produzido e utilizá-lo posteriormente no ChatGPT ou em outra ferramenta.

IDENTIDADE VISUAL

Crie uma interface moderna, profissional, criativa e organizada.

Utilize:

fundo grafite ou preto suave;

cards em tons escuros;

branco para textos principais;

laranja como cor de destaque;

detalhes sutis em roxo para ações criativas;

cantos arredondados;

ícones modernos;

boa separação entre blocos;

interface visual, mas sem excesso de elementos;

modo claro e modo escuro;

design totalmente responsivo.

A interface não deve parecer infantil nem excessivamente futurista.

TECNOLOGIA

Utilize Lovable Cloud ou Supabase para:

autenticação;

banco de dados;

armazenamento de logos e arquivos;

controle de acesso;

persistência dos conteúdos.

Implemente RLS para que cada usuário possa acessar somente seus próprios dados.

Nesta primeira fase, o aplicativo será utilizado principalmente por um administrador, mas a estrutura deve estar preparada para múltiplos usuários no futuro.

PÁGINAS

LOGIN

Criar login por e-mail e senha.

Incluir:

entrar;

recuperar senha;

permanecer conectado;

exibir ou ocultar senha.

INÍCIO

Criar um dashboard com:

botão “Criar novo conteúdo”;

quantidade de marcas cadastradas;

conteúdos em rascunho;

conteúdos aprovados;

conteúdos publicados;

prompts favoritos;

lista dos conteúdos mais recentes;

atalhos para Post, Carrossel, Stories, Reel e WhatsApp.

Adicionar uma mensagem de acolhimento:

“Está sem criatividade hoje? Escolha uma marca, preencha o briefing e deixe o Cria Aí organizar suas ideias.”

MINHAS MARCAS

Criar listagem em cards.

Cada card deve mostrar:

logo;

nome;

segmento;

cor principal;

quantidade de conteúdos;

botão editar;

botão criar conteúdo;

menu de opções.

Criar cadastro e edição de marca com os campos:

DADOS GERAIS

nome;

segmento;

descrição;

produtos e serviços;

região de atendimento;

site;

Instagram;

WhatsApp;

objetivo nas redes sociais.

PÚBLICO

público principal;

faixa etária;

necessidades;

dificuldades;

o que o público valoriza;

linguagem recomendada.

IDENTIDADE

personalidade da marca;

tom de voz;

palavras recomendadas;

palavras proibidas;

cores;

fontes;

estilo visual;

elementos gráficos;

referências;

diferenciais.

CONTEÚDO

assuntos permitidos;

assuntos que devem ser evitados;

serviços prioritários;

chamadas para ação;

dúvidas frequentes;

datas importantes;

informações legais;

informações que nunca podem ser inventadas.

ARQUIVOS

Permitir upload de:

logo principal;

logo alternativo;

fotos;

referências;

manual da marca;

artes anteriores.

Utilizar campos de etiquetas para listas como palavras recomendadas, palavras proibidas, assuntos e chamadas para ação.

NOVO CONTEÚDO

Criar um formulário em etapas com indicador visual de progresso.

ETAPA 1 — MARCA

Selecionar uma marca cadastrada.

Mostrar um resumo da identidade carregada:

logo;

cores;

tom de voz;

público;

principais regras.

ETAPA 2 — OBJETIVO

Permitir escolher:

informar;

educar;

vender;

divulgar serviço;

divulgar produto;

gerar contatos;

aumentar reconhecimento;

relacionamento;

comunicado;

data comemorativa;

bastidores;

campanha;

outro.

ETAPA 3 — FORMATOS

Permitir seleção múltipla:

Post para Feed;

Carrossel;

Story;

Sequência de Stories;

Status do WhatsApp;

Reel;

Capa de Reel;

Comunicado;

Banner;

Texto para grupo;

Material impresso;

Outro.

ETAPA 4 — BRIEFING

Campos:

título interno do projeto;

tema principal;

público específico;

problema ou necessidade;

mensagem principal;

informações obrigatórias;

chamada para ação;

data da publicação;

data do evento;

horário;

local;

valor;

contato;

estilo desejado;

nível de formalidade;

restrições;

observações;

materiais anexados.

Nenhum campo como data, valor, telefone ou local deve ser inventado.

ETAPA 5 — PACOTE DE ENTREGA

Permitir selecionar:

estratégia;

conceito criativo;

textos das artes;

layouts;

carrossel;

Stories;

roteiro de Reel;

legenda curta;

legenda intermediária;

legenda completa;

versão para WhatsApp;

hashtags;

recursos de engajamento;

prompt visual;

texto alternativo;

checklist de qualidade.

ETAPA 6 — MODO

Criar duas opções:

MODO SEGURO

Descrição:

“Prioriza textos separados da imagem, aplicação controlada de nomes, datas, valores e contatos e orientações completas para evitar erros.”

MODO RÁPIDO

Descrição:

“Cria prompts mais diretos para peças simples e textos curtos.”

ETAPA 7 — REVISÃO

Exibir um resumo completo antes da geração.

Criar botão:

“Montar pacote de prompts”

RESULTADO

Ao clicar em “Montar pacote de prompts”, não realizar chamada de IA.

Utilizar funções TypeScript para combinar:

dados da empresa;

briefing;

formatos;

pacote selecionado;

modo escolhido;

modelos de prompt armazenados.

Gerar blocos organizados:

resumo do briefing;

estratégia solicitada;

instruções de conceito criativo;

instruções para textos;

estrutura dos layouts;

estrutura do carrossel;

estrutura dos Stories;

estrutura de Reel;

instruções para legendas;

instruções para hashtags;

instruções de engajamento;

prompt visual;

auditoria final;

prompt mestre completo.

Cada bloco deve possuir:

copiar;

editar;

salvar;

favoritar;

restaurar texto original.

Adicionar botão principal:

“Copiar prompt completo”

Adicionar também:

exportar como TXT;

imprimir;

duplicar projeto;

marcar como aprovado;

marcar como publicado.

BIBLIOTECA

Criar uma biblioteca com filtros por:

empresa;

formato;

objetivo;

status;

período;

palavra-chave.

Status:

rascunho;

aguardando revisão;

aprovado;

publicado;

arquivado.

Exibir os projetos em cards ou tabela, com alternância entre as duas visualizações.

Permitir:

abrir;

editar;

duplicar;

arquivar;

excluir;

alterar status.

MODELOS

Criar página de modelos de conteúdo.

Modelos iniciais:

divulgação de serviço;

divulgação de produto;

comunicado;

vencimento de prazo;

carrossel educativo;

dúvida frequente;

apresentação da empresa;

benefício de serviço;

depoimento;

bastidores;

evento;

promoção;

campanha institucional;

prestação de contas;

captação de parceiros;

WhatsApp.

Cada modelo deve possuir:

nome;

descrição;

formatos recomendados;

objetivo;

campos sugeridos;

estrutura de prompt;

ativo ou inativo.

Permitir que o administrador crie e edite modelos.

CONFIGURAÇÕES

Criar:

dados do usuário;

aparência;

modo claro ou escuro;

formato padrão;

modo padrão de geração;

termos personalizados;

exportação dos dados;

exclusão da conta.

BANCO DE DADOS

Criar as tabelas:

profiles

id;

user_id;

full_name;

avatar_url;

created_at;

updated_at.

brands

id;

user_id;

name;

segment;

description;

products_services;

service_region;

website;

instagram;

whatsapp;

social_goal;

audience;

age_range;

audience_needs;

audience_difficulties;

audience_values;

audience_language;

personality;

tone_of_voice;

recommended_words;

prohibited_words;

primary_color;

secondary_color;

additional_colors;

fonts;

visual_style;

graphic_elements;

visual_references;

differentiators;

allowed_topics;

avoided_topics;

priority_services;

calls_to_action;

frequently_asked_questions;

important_dates;

legal_information;

forbidden_inventions;

logo_url;

is_active;

created_at;

updated_at.

brand_assets

id;

brand_id;

user_id;

asset_type;

file_name;

file_url;

description;

created_at.

content_projects

id;

user_id;

brand_id;

internal_title;

theme;

objective;

specific_audience;

audience_problem;

main_message;

mandatory_information;

call_to_action;

publication_date;

event_date;

event_time;

location;

price_information;

contact_information;

desired_style;

formality_level;

restrictions;

notes;

selected_formats;

selected_outputs;

generation_mode;

status;

is_favorite;

created_at;

updated_at.

content_outputs

id;

project_id;

user_id;

output_type;

title;

original_content;

edited_content;

display_order;

created_at;

updated_at.

prompt_templates

id;

user_id;

name;

description;

objective;

recommended_formats;

suggested_fields;

template_content;

is_system_template;

is_active;

created_at;

updated_at.

IMPLEMENTAÇÃO DO GERADOR

Criar um arquivo ou módulo responsável pela montagem dos prompts.

Exemplo:

src/lib/promptBuilder.ts

Esse módulo deve:

receber a marca;

receber o briefing;

receber os formatos;

receber os blocos solicitados;

receber o modo de geração;

sanitizar os campos vazios;

não exibir seções sem conteúdo;

montar instruções específicas por formato;

incluir as regras da marca;

incluir proibição de inventar informações;

adicionar checklist de auditoria;

retornar os blocos separados e o prompt completo.

O sistema deve gerar resultados consistentes sem utilizar IA.

EXPERIÊNCIA DO USUÁRIO

salvar automaticamente o formulário como rascunho;

impedir perda de dados ao atualizar a página;

exibir confirmação antes de excluir;

usar mensagens de sucesso e erro;

disponibilizar botões de copiar em todos os resultados;

indicar visualmente quando um texto foi copiado;

manter boa usabilidade no celular;

usar campos grandes e fáceis de preencher;

evitar formulários excessivamente longos em uma única tela;

utilizar etapas e seções recolhíveis.

SEGURANÇA

implementar RLS;

garantir que cada usuário acesse somente seus dados;

validar tipos e tamanho dos arquivos;

sanitizar entradas de texto;

não expor chaves ou segredos no frontend;

não implementar integração com IA nesta fase.

ENTREGA DESTA FASE

Implemente:

autenticação;

banco de dados;

cadastro de marcas;

criação do briefing;

montagem determinística dos prompts;

página de resultado;

biblioteca;

modelos;

responsividade;

modo claro e escuro.

Não implemente ainda:

geração de imagens;

integração com OpenAI;

integração com Lovable AI;

calendário de publicações;

postagem automática em redes sociais;

colaboração em equipe;

cobrança ou assinatura.

Ao concluir, apresente um resumo dos arquivos, tabelas, componentes e funcionalidades criadas.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://criaai-content-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/407c6002-29e0-4366-abe2-8c58600f5c58).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
