const { cleanupInactiveTickets } = require("../events/interactionHandler")

// Função para executar limpeza periódica
async function runPeriodicCleanup(client) {
  try {
    console.log("🧹 Iniciando limpeza periódica...")

    const { activeTickets, threadUsers } = global.ticketSystem

    // Para cada guild que o bot está
    for (const guild of client.guilds.cache.values()) {
      await cleanupInactiveTickets(activeTickets, threadUsers, guild)
    }

    console.log("✅ Limpeza periódica concluída")
  } catch (error) {
    console.error("❌ Erro na limpeza periódica:", error)
  }
}

// Configurar limpeza automática a cada 5 minutos
function setupPeriodicCleanup(client) {
  // Executar imediatamente
  setTimeout(() => runPeriodicCleanup(client), 30000) // 30 segundos após inicialização

  // Executar a cada 5 minutos
  setInterval(() => runPeriodicCleanup(client), 5 * 60 * 1000)

  console.log("🧹 Sistema de limpeza automática configurado")
}

module.exports = {
  runPeriodicCleanup,
  setupPeriodicCleanup,
}
