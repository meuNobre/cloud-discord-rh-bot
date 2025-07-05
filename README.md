
# 🌟 Bot Cloud - Processo Seletivo & Suporte via Discord

O **Cloud Bot** é uma solução completa desenvolvida com base na minha experiência em automação de processos seletivos e suporte ao candidato em servidores do Discord. Ele permite **gerenciar convites, tickets de suporte e comunicação direta com usuários**, tudo de forma intuitiva e automatizada.

## 📌 Funcionalidades

### ✅ Processo Seletivo Automatizado
- Envio de **convites interativos** para candidatos
- Botões para **aceitar**, **recusar** ou **solicitar suporte**
- Convite gerado automaticamente com tempo e usos limitados
- Totalmente personalizável para qualquer tipo de processo seletivo

### 🎧 Sistema de Suporte Integrado
- Modal para o usuário descrever o problema diretamente no Discord
- Criação automática de **threads públicas** vinculadas ao suporte
- Sincronização entre mensagens privadas (DMs) e a thread no servidor
- Botão para **encerrar o ticket** com aviso ao usuário

### 🧠 Banco de Dados (SQLite)
- Persistência de tickets em banco local
- Sincronização automática entre o banco de dados e a memória do bot
- Logs de atividades, threads e usuários vinculados

### 🧭 Painel de Controle ao Iniciar
- Mensagem enviada automaticamente ao iniciar o bot com:
  - Status geral
  - Contagem de tickets ativos
  - Botões: `🔄 Reiniciar`, `⛔ Desligar`, `🧪 Verificar Estado`
- Facilita o monitoramento e manutenção em tempo real

## 🧩 Tecnologias Utilizadas

- **Node.js** com JavaScript moderno
- **Discord.js v14**
- **SQLite** para banco de dados local
- Sistema de eventos, comandos e gerenciamento dinâmico

## 📁 Estrutura do Projeto

```
📦 iCloudBot/
├── commands/               # Comandos do bot organizados
├── events/                 # Handlers para eventos do Discord
├── database/
│   └── database.js         # Conexão e consultas com SQLite
├── config.json             # Configurações como token e IDs
├── index.js                # Arquivo principal do bot
├── README.md               # Esta documentação
```

> O bot se conectará automaticamente e enviará o painel de controle no canal pré-definido.

## 🧪 Comandos Disponíveis

- `/convite-processo` – Envia convite interativo a um usuário
- (Mais comandos podem ser adicionados facilmente via em [Comandos](https://cloud-discord-bot-web.onrender.com/index.html#commands))


## 👨‍💻 Desenvolvedor

Criado por **Nobre**, desenvolvedor fullstack com experiência em automações para comunidades no Discord, bots para processos seletivos e sistemas de atendimento. Também é o criador do projeto [Robótica Sem Limites](https://instagram.com/nobredoscodigos).

## Acesse tudo sobre o Cloud  e entre em contato em:  [Docs do Cloud](https://cloud-discord-bot-web.onrender.com/index.html)
