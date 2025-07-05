// Sistema de proteção contra execuções múltiplas
class InteractionGuard {
  constructor() {
    this.activeInteractions = new Map()
    this.commandCooldowns = new Map()
  }

  // Verificar se a interação já está sendo processada
  isProcessing(interactionId) {
    return this.activeInteractions.has(interactionId)
  }

  // Marcar interação como em processamento
  startProcessing(interactionId, userId, commandName) {
    const key = `${userId}_${commandName}`

    // Verificar cooldown por usuário/comando
    if (this.commandCooldowns.has(key)) {
      const lastExecution = this.commandCooldowns.get(key)
      const timeDiff = Date.now() - lastExecution

      if (timeDiff < 3000) {
        // 3 segundos de cooldown
        return false
      }
    }

    this.activeInteractions.set(interactionId, {
      userId,
      commandName,
      startTime: Date.now(),
    })

    this.commandCooldowns.set(key, Date.now())

    // Auto-cleanup após 15 segundos
    setTimeout(() => {
      this.finishProcessing(interactionId)
    }, 15000)

    return true
  }

  // Marcar interação como finalizada
  finishProcessing(interactionId) {
    this.activeInteractions.delete(interactionId)
  }

  // Limpar interações antigas
  cleanup() {
    const now = Date.now()
    for (const [id, data] of this.activeInteractions.entries()) {
      if (now - data.startTime > 15000) {
        // 15 segundos
        this.activeInteractions.delete(id)
      }
    }
  }
}

// Instância global
const interactionGuard = new InteractionGuard()

// Cleanup automático a cada 30 segundos
setInterval(() => {
  interactionGuard.cleanup()
}, 30000)

module.exports = interactionGuard
