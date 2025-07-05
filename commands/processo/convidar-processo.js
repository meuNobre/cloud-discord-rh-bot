const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js")

// Cores do tema Hylex
const COLORS = {
  PRIMARY: "#00D9FF", // Azul Hylex
  SUCCESS: "#00FF88", // Verde sucesso
  ERROR: "#FF4757", // Vermelho erro
  WARNING: "#FFA502", // Laranja aviso
  SECONDARY: "#5F27CD", // Roxo secundário
  GOLD: "#FFD700", // Dourado especial
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("convidar-processo")
    .setDescription("🎯 Envia um convite do processo seletivo para um candidato")
    .addUserOption((option) =>
      option.setName("candidato").setDescription("👤 Selecione o usuário candidato").setRequired(true),
    ),

  async execute(interaction) {
    // Verificar se a interação não expirou
    const interactionAge = Date.now() - interaction.createdTimestamp
    if (interactionAge > 2500) {
      console.warn(`⚠️ Interação muito antiga (${interactionAge}ms), ignorando...`)
      return
    }

    try {
      console.log(`🔍 [DEBUG] Iniciando comando convidar-processo`)
      console.log(`   👤 Executado por: ${interaction.user.tag}`)
      console.log(`   ⏰ Idade da interação: ${interactionAge}ms`)

      const database = global.ticketSystem.database

      // Responder imediatamente para evitar timeout
      await interaction.reply({
        content: "🔄 Processando convite...",
        ephemeral: true,
      })

      // Debug das opções disponíveis
      console.log(`🔍 [DEBUG] Opções disponíveis:`)
      interaction.options.data.forEach((option, index) => {
        console.log(`   ${index + 1}. ${option.name}: ${option.value} (tipo: ${option.type})`)
        if (option.user) {
          console.log(`      👤 Usuário: ${option.user.tag} (${option.user.id})`)
        }
      })

      // Tentar obter o usuário de diferentes formas
      let candidato = null

      // Método 1: getUser()
      try {
        candidato = interaction.options.getUser("candidato")
        console.log(`🔍 [DEBUG] Método 1 (getUser): ${candidato ? candidato.tag : "null"}`)
      } catch (error) {
        console.log(`❌ [DEBUG] Erro no método 1: ${error.message}`)
      }

      // Método 2: get() + fetch se método 1 falhou
      if (!candidato) {
        try {
          const option = interaction.options.get("candidato")
          console.log(`🔍 [DEBUG] Opção raw:`, option)

          if (option && option.value) {
            candidato = await interaction.client.users.fetch(option.value, { force: true })
            console.log(`🔍 [DEBUG] Método 2 (fetch): ${candidato ? candidato.tag : "null"}`)
          }
        } catch (error) {
          console.log(`❌ [DEBUG] Erro no método 2: ${error.message}`)
        }
      }

      // Método 3: Buscar na cache do cliente
      if (!candidato) {
        try {
          const option = interaction.options.get("candidato")
          if (option && option.value) {
            candidato = interaction.client.users.cache.get(option.value)
            console.log(`🔍 [DEBUG] Método 3 (cache): ${candidato ? candidato.tag : "null"}`)
          }
        } catch (error) {
          console.log(`❌ [DEBUG] Erro no método 3: ${error.message}`)
        }
      }

      // Se ainda não encontrou o usuário
      if (!candidato) {
        console.error(`❌ [DEBUG] Nenhum método conseguiu obter o usuário`)

        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Usuário Não Encontrado")
          .setDescription("Não foi possível encontrar o usuário selecionado.")
          .setColor(COLORS.ERROR)
          .addFields(
            {
              name: "🔧 Possíveis Soluções",
              value:
                "• Tente executar o comando novamente\n• Verifique se o usuário ainda está no servidor\n• Contate um administrador se o problema persistir",
              inline: false,
            },
            {
              name: "🔍 Debug Info",
              value: `Idade da interação: ${interactionAge}ms\nOpções: ${interaction.options.data.length}`,
              inline: false,
            },
          )
          .setFooter({ text: "Hylex • Sistema de Recrutamento" })
          .setTimestamp()

        return await interaction.editReply({ content: null, embeds: [errorEmbed] })
      }

      console.log(`✅ [DEBUG] Usuário encontrado: ${candidato.tag} (${candidato.id})`)

      // Verificações de segurança
      if (candidato.bot) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Usuário Inválido")
          .setDescription("Não é possível enviar convites para bots.")
          .setColor(COLORS.ERROR)
          .setFooter({ text: "Hylex • Sistema de Recrutamento" })
          .setTimestamp()

        return await interaction.editReply({ content: null, embeds: [errorEmbed] })
      }

      if (candidato.id === interaction.user.id) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Ação Inválida")
          .setDescription("Você não pode enviar um convite para si mesmo.")
          .setColor(COLORS.ERROR)
          .setFooter({ text: "Hylex • Sistema de Recrutamento" })
          .setTimestamp()

        return await interaction.editReply({ content: null, embeds: [errorEmbed] })
      }

      // Verificar convites pendentes
      try {
        console.log(`🔍 [DEBUG] Verificando convites pendentes...`)
        const existingInvite = await database.getPendingInviteByUser(candidato.id)

        if (existingInvite) {
          console.log(`⚠️ [DEBUG] Convite pendente encontrado`)

          const errorEmbed = new EmbedBuilder()
            .setTitle("⚠️ Convite Já Existe")
            .setDescription(`${candidato.tag} já possui um convite pendente.`)
            .setColor(COLORS.WARNING)
            .addFields(
              {
                name: "📅 Enviado em",
                value: `<t:${Math.floor(new Date(existingInvite.sent_at).getTime() / 1000)}:F>`,
                inline: true,
              },
              {
                name: "⏰ Status",
                value: existingInvite.status || "pending",
                inline: true,
              },
            )
            .setFooter({ text: "Hylex • Sistema de Recrutamento" })
            .setTimestamp()

          return await interaction.editReply({ content: null, embeds: [errorEmbed] })
        }

        console.log(`✅ [DEBUG] Nenhum convite pendente`)
      } catch (dbError) {
        console.error("❌ Erro ao verificar convites:", dbError)
        // Continuar mesmo com erro
      }

      // Atualizar status
      await interaction.editReply({ content: "📤 Tentando enviar convite via DM..." })

      // Tentar criar DM
      console.log(`📤 [DEBUG] Criando DM...`)
      let dm
      try {
        dm = await candidato.createDM()
        console.log(`✅ [DEBUG] DM criado`)
      } catch (dmError) {
        console.error("❌ Erro ao criar DM:", dmError)

        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Não Foi Possível Criar DM")
          .setDescription(`Não foi possível criar canal de mensagem privada com ${candidato.tag}.`)
          .setColor(COLORS.ERROR)
          .addFields({
            name: "🔧 Possíveis Causas",
            value:
              "• Usuário bloqueou o bot\n• Configurações de privacidade restritivas\n• Usuário não compartilha servidores com o bot",
            inline: false,
          })
          .setFooter({ text: "Hylex • Sistema de Recrutamento" })
          .setTimestamp()

        return await interaction.editReply({ content: null, embeds: [errorEmbed] })
      }

      // Criar embeds do convite
      const inviteEmbed = new EmbedBuilder()
        .setTitle("🎉 Você foi Selecionado!")
        .setDescription(`Olá, **${candidato.username}**! Somos da equipe de **Recrutamento e Seleção** do Hylex.`)
        .setColor(COLORS.PRIMARY)
        .addFields(
          {
            name: "✨ Primeira Etapa Concluída",
            value: "Analisamos sua aplicação e **você foi aprovado** na primeira etapa do processo seletivo!",
            inline: false,
          },
          {
            name: "📋 Regras do Processo",
            value:
              "• Este é um processo **confidencial**\n• Não compartilhe informações sobre sua participação\n• Responda com honestidade durante todo o processo\n• Mantenha profissionalismo em todas as interações",
            inline: false,
          },
          {
            name: "⏰ Prazo de Resposta",
            value: "Você tem **24 horas** para responder a este convite",
            inline: true,
          },
          {
            name: "🎯 Próximos Passos",
            value: "Escolha uma das opções abaixo para continuar",
            inline: true,
          },
          {
            name: "📞 Suporte",
            value: "Use o botão de suporte se tiver dúvidas",
            inline: true,
          },
        )
        .setFooter({
          text: "Hylex • Equipe de Recrutamento e Seleção",
          iconURL: "https://hylex.gg/cdn/shop/files/hylex-tiny.png?v=1683307225&width=500",
        })
        .setTimestamp()
        .setThumbnail(candidato.displayAvatarURL({ dynamic: true }))

      const welcomeEmbed = new EmbedBuilder()
        .setTitle("🏆 Aprovado na primeira etapa do Processo Seletivo Hylex")
        .setDescription("Estamos animados para conhecê-lo melhor!")
        .setColor(COLORS.GOLD)
        .addFields(
          {
            name: "🌟 Por que você foi escolhido?",
            value: "Seu perfil e experiência chamaram nossa atenção",
            inline: true,
          },
          {
            name: "🚀 O que esperar?",
            value: "Um processo dinâmico e desafiador",
            inline: true,
          },
        )
        .setFooter({ text: "É um prazer tê-lo conosco! 💙" })
        .setTimestamp()

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("sim").setLabel("✅ Sim, quero prosseguir!").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("nao").setLabel("❌ Não desejo continuar").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("suporte").setLabel("🎧 Preciso de suporte").setStyle(ButtonStyle.Secondary),
      )

      // Tentar enviar convite via DM
      console.log(`📤 [DEBUG] Enviando mensagem DM...`)
      let dmMessage
      let dmSuccess = false

      try {
        dmMessage = await dm.send({
          embeds: [inviteEmbed, welcomeEmbed],
          components: [actionRow],
        })
        console.log(`✅ [DEBUG] Convite enviado via DM - ID: ${dmMessage.id}`)
        dmSuccess = true
      } catch (sendError) {
        console.error("❌ Erro ao enviar DM:", sendError)

        // Verificar se é erro de DM bloqueada
        if (sendError.code === 50007) {
          console.log(`⚠️ [DEBUG] DMs bloqueadas para ${candidato.tag}, tentando alternativa...`)

          // Criar convite mesmo sem conseguir enviar DM
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas

          try {
            console.log(`💾 [DEBUG] Salvando convite no banco (DM bloqueada)...`)
            await database.createInvite(
              candidato.id,
              candidato.tag,
              "dm_blocked", // ID especial para DMs bloqueadas
              interaction.user.id,
              expiresAt.toISOString(),
            )
            console.log(`✅ [DEBUG] Convite salvo no banco`)
          } catch (dbError) {
            console.error("❌ Erro ao salvar no banco:", dbError)
          }

          // Resposta informando sobre DM bloqueada
          const dmBlockedEmbed = new EmbedBuilder()
            .setTitle("⚠️ DM Bloqueada - Convite Registrado")
            .setDescription(
              `Não foi possível enviar DM para **${candidato.tag}**, mas o convite foi registrado no sistema.`,
            )
            .setColor(COLORS.WARNING)
            .addFields(
              {
                name: "👤 Candidato",
                value: `${candidato.tag}`,
                inline: true,
              },
              {
                name: "📅 Registrado em",
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: true,
              },
              {
                name: "⏰ Status",
                value: "DM Bloqueada",
                inline: true,
              },
              {
                name: "🔧 Problema",
                value:
                  "• O usuário bloqueou DMs de membros do servidor\n• Configurações de privacidade restritivas\n• O usuário pode ter bloqueado o bot",
                inline: false,
              },
              {
                name: "💡 Próximos Passos",
                value:
                  "• Peça para o usuário abrir suas DMs\n• Contate o usuário por outros meios\n• Use o comando novamente após o usuário ajustar as configurações",
                inline: false,
              },
              {
                name: "📋 Instruções para o Usuário",
                value:
                  "1. Ir em **Configurações do Usuário**\n2. **Privacidade e Segurança**\n3. Ativar **'Permitir mensagens diretas de membros do servidor'**\n4. Tentar novamente",
                inline: false,
              },
            )
            .setFooter({ text: "Hylex • Sistema de Recrutamento" })
            .setTimestamp()
            .setThumbnail(candidato.displayAvatarURL({ dynamic: true }))

          return await interaction.editReply({ content: null, embeds: [dmBlockedEmbed] })
        } else {
          // Outro tipo de erro
          const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Erro ao Enviar Convite")
            .setDescription("Ocorreu um erro inesperado ao enviar o convite via DM.")
            .setColor(COLORS.ERROR)
            .addFields(
              {
                name: "🔧 Detalhes do Erro",
                value: `\`${sendError.message}\``,
                inline: false,
              },
              {
                name: "🆔 Código do Erro",
                value: `\`${sendError.code || "N/A"}\``,
                inline: true,
              },
              {
                name: "🔄 Ação Recomendada",
                value: "Tente novamente em alguns minutos",
                inline: true,
              },
            )
            .setFooter({ text: "Hylex • Sistema de Recrutamento" })
            .setTimestamp()

          return await interaction.editReply({ content: null, embeds: [errorEmbed] })
        }
      }

      // Se chegou aqui, o DM foi enviado com sucesso
      if (dmSuccess && dmMessage) {
        // Salvar no banco
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
        try {
          console.log(`💾 [DEBUG] Salvando no banco...`)
          await database.createInvite(
            candidato.id,
            candidato.tag,
            dmMessage.id,
            interaction.user.id,
            expiresAt.toISOString(),
          )
          console.log(`✅ [DEBUG] Salvo no banco`)
        } catch (dbError) {
          console.error("❌ Erro ao salvar no banco:", dbError)
          // Continuar mesmo com erro
        }

        // Verificar processo ativo
        let processInfo = ""
        try {
          const activeProcess = await database.getActiveProcess()
          if (activeProcess) {
            const processStats = await database.getProcessStats(activeProcess.id)
            processInfo = `\n**📋 Processo Ativo:** ${activeProcess.name}\n**👥 Total de Candidatos:** ${processStats.total_participants}`
          }
        } catch (error) {
          console.error("Erro ao buscar processo ativo:", error)
        }

        // Resposta final de sucesso
        const confirmationEmbed = new EmbedBuilder()
          .setTitle("✅ Convite Enviado com Sucesso!")
          .setDescription(`O convite foi enviado via DM para **${candidato.tag}**${processInfo}`)
          .setColor(COLORS.SUCCESS)
          .addFields(
            {
              name: "👤 Candidato",
              value: `${candidato.tag}`,
              inline: true,
            },
            {
              name: "📅 Enviado em",
              value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
              inline: true,
            },
            {
              name: "⏰ Prazo",
              value: "24 horas para resposta",
              inline: true,
            },
            {
              name: "📊 Status",
              value: "⏳ Aguardando resposta",
              inline: false,
            },
            {
              name: "🆔 Detalhes Técnicos",
              value: `**Message ID:** \`${dmMessage.id}\`\n**Channel ID:** \`${dmMessage.channel.id}\``,
              inline: false,
            },
            {
              name: "💡 Próximos Passos",
              value: "O sistema notificará automaticamente quando o candidato responder",
              inline: false,
            },
          )
          .setFooter({ text: "Hylex • Sistema de Recrutamento" })
          .setTimestamp()
          .setThumbnail(candidato.displayAvatarURL({ dynamic: true }))

        const confirmationMessage = await interaction.editReply({
          content: null,
          embeds: [confirmationEmbed],
        })

        // Salvar ID da mensagem de confirmação
        try {
          await database.updateInviteConfirmationMessage(
            candidato.id,
            dmMessage.id,
            confirmationMessage.id,
            interaction.channelId,
          )
        } catch (dbError) {
          console.error("❌ Erro ao atualizar confirmação:", dbError)
        }

        console.log(`🎉 [DEBUG] Processo concluído com sucesso para: ${candidato.tag}`)
      }
    } catch (error) {
      console.error("❌ [ERROR] Erro geral:", error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro Interno")
        .setDescription("Ocorreu um erro interno ao processar o convite.")
        .setColor(COLORS.ERROR)
        .addFields(
          {
            name: "🔧 Detalhes do Erro",
            value: `\`\`\`${error.message}\`\`\``,
            inline: false,
          },
          {
            name: "🔄 Ação Necessária",
            value: "Tente novamente ou contate um administrador se o problema persistir.",
            inline: false,
          },
        )
        .setFooter({ text: "Hylex • Sistema de Convites" })
        .setTimestamp()

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: null, embeds: [errorEmbed] })
        } else {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
        }
      } catch (replyError) {
        console.error("❌ Erro ao responder com erro:", replyError)
      }
    }
  },
}