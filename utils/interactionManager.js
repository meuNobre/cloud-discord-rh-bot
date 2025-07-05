// Sistema centralizado de gerenciamento de interações
class InteractionManager {
  constructor() {
    this.processingInteractions = new Set()
    this.processedInteractions = new Map()
    this.interactionLocks = new Map()
  }

  // Verificar se a interação é válida e pode ser processada
  canProcessInteraction(interaction) {
    const interactionId = interaction.id
    const interactionAge = Date.now() - interaction.createdTimestamp

    console.log(`🔍 [INTERACTION_MANAGER] Verificando interação:`)
    console.log(`   🆔 ID: ${interactionId}`)
    console.log(`   ⏰ Idade: ${interactionAge}ms`)
    console.log(`   ✅ Replied: ${interaction.replied}`)
    console.log(`   ⏳ Deferred: ${interaction.deferred}`)
    console.log(`   🔒 Em processamento: ${this.processingInteractions.has(interactionId)}`)
    console.log(`   ✅ Já processada: ${this.processedInteractions.has(interactionId)}`)

    // Verificar se a interação é muito antiga
    if (interactionAge > 1500) {
      console.warn(`⚠️ [INTERACTION_MANAGER] Interação muito antiga (${interactionAge}ms)`)
      return false
    }

    // Verificar se já foi respondida/deferida
    if (interaction.replied || interaction.deferred) {
      console.warn(`⚠️ [INTERACTION_MANAGER] Interação já foi respondida/deferida`)
      return false
    }

    // Verificar se já está sendo processada
    if (this.processingInteractions.has(interactionId)) {
      console.warn(`⚠️ [INTERACTION_MANAGER] Interação já está sendo processada`)
      return false
    }

    // Verificar se já foi processada
    if (this.processedInteractions.has(interactionId)) {
      console.warn(`⚠️ [INTERACTION_MANAGER] Interação já foi processada`)
      return false
    }

    return true
  }

  // Marcar interação como sendo processada
  startProcessing(interaction) {
    const interactionId = interaction.id
    console.log(`🔒 [INTERACTION_MANAGER] Iniciando processamento: ${interactionId}`)

    this.processingInteractions.add(interactionId)
    this.interactionLocks.set(interactionId, Date.now())

    // Auto-cleanup após 30 segundos
    setTimeout(() => {
      this.finishProcessing(interaction)
    }, 30000)
  }

  // Marcar interação como processada
  finishProcessing(interaction) {
    const interactionId = interaction.id
    console.log(`✅ [INTERACTION_MANAGER] Finalizando processamento: ${interactionId}`)

    this.processingInteractions.delete(interactionId)
    this.interactionLocks.delete(interactionId)
    this.processedInteractions.set(interactionId, Date.now())

    // Limpar cache antigo
    this.cleanupCache()
  }

  // Limpar cache antigo
  cleanupCache() {
    const now = Date.now()
    const maxAge = 300000 // 5 minutos

    // Limpar interações processadas antigas
    for (const [id, timestamp] of this.processedInteractions.entries()) {
      if (now - timestamp > maxAge) {
        this.processedInteractions.delete(id)
      }
    }

    // Limpar locks antigos
    for (const [id, timestamp] of this.interactionLocks.entries()) {
      if (now - timestamp > maxAge) {
        this.interactionLocks.delete(id)
        this.processingInteractions.delete(id)
      }
    }
  }

  // Resposta segura para interações
  async safeReply(interaction, content) {
    const interactionAge = Date.now() - interaction.createdTimestamp

    console.log(`📤 [INTERACTION_MANAGER] Tentando responder:`)
    console.log(`   ⏰ Idade: ${interactionAge}ms`)
    console.log(`   ✅ Replied: ${interaction.replied}`)
    console.log(`   ⏳ Deferred: ${interaction.deferred}`)

    // Verificar se ainda é válida
    if (interactionAge > 2500) {
      console.warn(`⚠️ [INTERACTION_MANAGER] Interação muito antiga para responder`)
      return null
    }

    try {
      if (!interaction.replied && !interaction.deferred) {
        console.log(`📤 [INTERACTION_MANAGER] Usando reply()`)
        return await interaction.reply(content)
      } else if (interaction.deferred && !interaction.replied) {
        console.log(`📤 [INTERACTION_MANAGER] Usando followUp()`)
        return await interaction.followUp(content)
      } else {
        console.warn(`⚠️ [INTERACTION_MANAGER] Não pode responder - estado inválido`)
        return null
      }
    } catch (error) {
      console.error(`❌ [INTERACTION_MANAGER] Erro ao responder:`, error.message)
      return null
    }
  }

  // Defer seguro para interações
  async safeDefer(interaction, options = {}) {
    const interactionAge = Date.now() - interaction.createdTimestamp

    console.log(`⏳ [INTERACTION_MANAGER] Tentando defer:`)
    console.log(`   ⏰ Idade: ${interactionAge}ms`)
    console.log(`   ✅ Replied: ${interaction.replied}`)
    console.log(`   ⏳ Deferred: ${interaction.deferred}`)

    // Verificar se ainda é válida
    if (interactionAge > 1500) {
      console.warn(`⚠️ [INTERACTION_MANAGER] Interação muito antiga para defer`)
      throw new Error("Interação muito antiga")
    }

    // Verificar se já foi respondida/deferida
    if (interaction.replied || interaction.deferred) {
      console.warn(`⚠️ [INTERACTION_MANAGER] Interação já foi respondida/deferida`)
      throw new Error("Interação já processada")
    }

    try {
      console.log(`⏳ [INTERACTION_MANAGER] Executando deferReply()`)

      // Timeout ainda mais agressivo
      const deferPromise = interaction.deferReply(options)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout no deferReply")), 1000),
      )

      await Promise.race([deferPromise, timeoutPromise])
      console.log(`✅ [INTERACTION_MANAGER] DeferReply bem-sucedido`)
      return true
    } catch (error) {
      console.error(`❌ [INTERACTION_MANAGER] Erro no defer:`, error.message)
      throw error
    }
  }
}

// Instância global
const interactionManager = new InteractionManager()

module.exports = { interactionManager }
