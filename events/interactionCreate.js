const { interactionManager } = require("../utils/interactionManager")
const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require("discord.js")
const { database } = require("../database/database")
const { GUILD_ID, SUPORTE_CHANNEL_ID } = process.env
const activeTickets = new Map()
const threadUsers = new Map()

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName)

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`)
        return
      }

      try {
        await command.execute(interaction)
      } catch (error) {
        console.error(error)
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "There was an error while executing this command!",
            ephemeral: true,
          })
        } else {
          await interaction.reply({
            content: "There was an error while executing this command!",
            ephemeral: true,
          })
        }
      }
    } else if (interaction.isButton()) {
      const { customId } = interaction

      // Botão de confirmar entrada no servidor
      if (customId.startsWith("confirm_entry_")) {
        const [, userId, messageId] = customId.split("_")
        console.log(`✅ Usuário confirmou entrada: ${userId}`)

        try {
          await interaction.deferReply({ ephemeral: true })

          // Verificar se o usuário realmente entrou no servidor
          const guild = interaction.client.guilds.cache.get(GUILD_ID)
          const member = await guild.members.fetch(userId)
          if (!member) {
            await interaction.editReply({
              content: "❌ Você precisa entrar no servidor antes de confirmar.",
            })
            return
          }

          // Atualizar status do convite
          await database.updateInviteStatus(userId, messageId, "confirmed")

          const confirmEmbed = new EmbedBuilder()
            .setTitle("🎉 Entrada Confirmada")
            .setDescription("Sua entrada no servidor foi confirmada com sucesso!")
            .setColor("#3BA55D")
            .setFooter({ text: "iCloud Bot • Processo Seletivo" })
            .setTimestamp()

          await interaction.editReply({ embeds: [confirmEmbed], components: [] })
        } catch (error) {
          console.error("Erro ao confirmar entrada:", error)
          await interaction.editReply({
            content: "❌ Ocorreu um erro ao confirmar sua entrada. Tente novamente.",
          })
        }
        return
      }

      // Botão de encerrar ticket
      if (customId === "encerrar_ticket") {
        const userId = threadUsers.get(interaction.channel.id)
        if (!userId) {
          await interaction.reply({
            content: "❌ Ticket inválido.",
            ephemeral: true,
          })
          return
        }

        try {
          await interaction.deferReply({ ephemeral: true })

          // Encerrar thread
          await interaction.channel.setArchived(true)

          // Remover do sistema global
          activeTickets.delete(userId)
          threadUsers.delete(interaction.channel.id)

          // Atualizar banco de dados
          await database.closeTicket(userId, interaction.channel.id)

          const closeEmbed = new EmbedBuilder()
            .setTitle("🔒 Ticket Encerrado")
            .setDescription("Este ticket foi encerrado por um membro da equipe.")
            .setColor("#E74C3C")
            .setFooter({ text: "iCloud Bot • Sistema de Suporte" })
            .setTimestamp()

          await interaction.editReply({ embeds: [closeEmbed] })
        } catch (error) {
          console.error("Erro ao encerrar ticket:", error)
          await interaction.editReply({
            content: "❌ Ocorreu um erro ao encerrar o ticket. Tente novamente.",
          })
        }
        return
      }

      // Botões de resposta ao convite
      if (["sim", "nao", "suporte"].includes(customId)) {
        console.log(`🔍 [CONVITE] Processando resposta: ${customId}`)

        // Verificar se pode processar a interação
        if (!interactionManager.canProcessInteraction(interaction)) {
          console.warn(`⚠️ [CONVITE] Interação não pode ser processada`)
          return
        }

        // Marcar como sendo processada
        interactionManager.startProcessing(interaction)

        try {
          await interactionManager.safeDefer(interaction, { ephemeral: true })

          const userId = interaction.user.id
          const messageId = interaction.message.id

          // Buscar convite no banco
          const invite = await database.getInviteStatus(userId, messageId)
          if (!invite) {
            await interactionManager.safeReply(interaction, {
              content: "❌ Convite não encontrado ou já processado.",
            })
            return
          }

          if (invite.status !== "pending") {
            await interactionManager.safeReply(interaction, {
              content: `⚠️ Este convite já foi ${invite.status === "accepted" ? "aceito" : "recusado"}.`,
            })
            return
          }

          // Processar resposta
          if (customId === "sim") {
            // Aceitar convite
            const guild = interaction.client.guilds.cache.get(GUILD_ID)
            const channel = guild?.channels.cache.find((ch) => ch.isTextBased())
            if (!guild || !channel) {
              await interactionManager.safeReply(interaction, {
                content: "❌ Erro ao localizar o servidor ou canal.",
              })
              return
            }

            try {
              const inviteUrl = await channel.createInvite({
                maxAge: 86400,
                maxUses: 1,
                unique: true,
                reason: `Convite para processo seletivo - usuário ${userId}`,
              })

              await database.updateInviteStatus(userId, messageId, "accepted", inviteUrl.url)

              // Adicionar candidato ao processo ativo (se houver)
              try {
                const activeProcess = await database.getActiveProcess()
                if (activeProcess) {
                  const participants = await database.getProcessParticipants(activeProcess.id)
                  const existingParticipant = participants.find((p) => p.user_id === userId)
                  if (!existingParticipant) {
                    await database.addParticipant(activeProcess.id, userId, interaction.user.tag)
                    console.log(`✅ Candidato ${userId} adicionado ao processo ${activeProcess.id}`)
                  }
                }
              } catch (error) {
                console.error("Erro ao adicionar candidato ao processo:", error)
              }

              const successEmbed = new EmbedBuilder()
                .setTitle("🏆 Bem-vindo ao Processo Seletivo")
                .setDescription(`Olá, <@${userId}>! Somos da equipe de **Recrutamento e Seleção** novamente.`)
                .setColor("#00FF88")
                .addFields(
                  {
                    name: "📋 Primeira Etapa Concluída",
                    value: "Que bom que você decidiu prosseguir para a segunda etapa do processo seletivo!",
                    inline: false,
                  },
                  {
                    name: "⚠️ Regras Importantes",
                    value:
                      "• Não compartilhe informações confidenciais\n• Não revele sua participação no processo\n• Siga todas as diretrizes do servidor",
                    inline: false,
                  },
                  {
                    name: "🔗 Seu Convite Exclusivo",
                    value: `[**Clique aqui para entrar**](${inviteUrl.url})`,
                    inline: false,
                  },
                  {
                    name: "⏰ Validade",
                    value: "24 horas",
                    inline: true,
                  },
                  {
                    name: "🎫 Usos",
                    value: "1 uso único",
                    inline: true,
                  },
                  {
                    name: "❓ Precisa de Ajuda?",
                    value: "Use o botão de suporte",
                    inline: true,
                  },
                  {
                    name: "✅ Próximo Passo",
                    value: "Após entrar no servidor, clique no botão abaixo para confirmar sua entrada",
                    inline: false,
                  },
                )
                .setFooter({ text: "iCloud Bot • Equipe de Recrutamento e Seleção" })
                .setTimestamp()

              const confirmEntryButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`confirm_entry_${userId}_${messageId}`)
                  .setLabel("✅ Confirmar que entrei no servidor")
                  .setStyle(ButtonStyle.Success),
              )

              await interactionManager.safeReply(interaction, {
                embeds: [successEmbed],
                components: [confirmEntryButton],
              })

              // Atualizar mensagem de confirmação no canal
              if (invite.confirmation_message_id && invite.confirmation_channel_id) {
                try {
                  const confirmationChannel = interaction.client.channels.cache.get(invite.confirmation_channel_id)
                  if (confirmationChannel) {
                    const confirmationMessage = await confirmationChannel.messages.fetch(invite.confirmation_message_id)
                    if (confirmationMessage) {
                      const updatedEmbed = EmbedBuilder.from(confirmationMessage.embeds[0])
                        .setColor("#00FF88")
                        .setFields(
                          confirmationMessage.embeds[0].fields.map((field) =>
                            field.name === "📊 Status" ? { ...field, value: "✅ Aceito!" } : field,
                          ),
                        )
                      await confirmationMessage.edit({ embeds: [updatedEmbed] })
                    }
                  }
                } catch (error) {
                  console.error("Erro ao atualizar mensagem de confirmação:", error)
                }
              }
            } catch (error) {
              console.error("Erro ao criar convite:", error)
              await interactionManager.safeReply(interaction, {
                content: "❌ Erro ao gerar convite. Tente novamente.",
              })
            }
          } else if (customId === "nao") {
            // Recusar convite
            await database.updateInviteStatus(userId, messageId, "declined")
            const declineEmbed = new EmbedBuilder()
              .setTitle("❌ Convite Recusado")
              .setDescription("Você optou por não participar do processo seletivo.")
              .setColor("#FF4757")
              .addFields({
                name: "💭 Feedback",
                value: "Agradecemos seu interesse. Talvez em uma próxima oportunidade!",
                inline: false,
              })
              .setFooter({ text: "iCloud Bot • Processo Seletivo" })
              .setTimestamp()

            await interactionManager.safeReply(interaction, { embeds: [declineEmbed] })

            // Atualizar mensagem de confirmação
            if (invite.confirmation_message_id && invite.confirmation_channel_id) {
              try {
                const confirmationChannel = interaction.client.channels.cache.get(invite.confirmation_channel_id)
                if (confirmationChannel) {
                  const confirmationMessage = await confirmationChannel.messages.fetch(invite.confirmation_message_id)
                  if (confirmationMessage) {
                    const updatedEmbed = EmbedBuilder.from(confirmationMessage.embeds[0])
                      .setColor("#FF4757")
                      .setFields(
                        confirmationMessage.embeds[0].fields.map((field) =>
                          field.name === "📊 Status" ? { ...field, value: "❌ Recusado" } : field,
                        ),
                      )
                    await confirmationMessage.edit({ embeds: [updatedEmbed] })
                  }
                }
              } catch (error) {
                console.error("Erro ao atualizar mensagem de confirmação:", error)
              }
            }
          } else if (customId === "suporte") {
            // Abrir ticket de suporte
            const existingTicket = await database.getActiveTicketByUser(userId)
            if (existingTicket) {
              await interactionManager.safeReply(interaction, {
                content: `⚠️ Você já possui um ticket ativo: <#${existingTicket.thread_id}>`,
              })
              return
            }

            // Criar thread de suporte
            const guild = interaction.client.guilds.cache.get(GUILD_ID)
            const supportChannel = guild?.channels.cache.get(SUPORTE_CHANNEL_ID)
            if (!supportChannel) {
              await interactionManager.safeReply(interaction, {
                content: "❌ Canal de suporte não encontrado. Contate um administrador.",
              })
              return
            }

            const thread = await supportChannel.threads.create({
              name: `🎧 Suporte - ${interaction.user.username}`,
              type: ChannelType.PublicThread,
              reason: "Suporte para processo seletivo",
            })

            // Salvar ticket no banco
            const ticketId = await database.createTicket(
              userId,
              interaction.user.username,
              interaction.user.displayName,
              "Suporte - Processo Seletivo",
              thread.id,
            )

            // Atualizar sistema global
            activeTickets.set(userId, thread.id)
            threadUsers.set(thread.id, userId)

            const supportEmbed = new EmbedBuilder()
              .setTitle("🎧 Suporte Criado")
              .setDescription(`Seu ticket de suporte foi criado: <#${thread.id}>`)
              .setColor("#5F27CD")
              .addFields({
                name: "📋 Instruções",
                value: "Nossa equipe responderá em breve. Descreva sua dúvida ou problema no canal criado.",
                inline: false,
              })
              .setFooter({ text: "iCloud Bot • Sistema de Suporte" })
              .setTimestamp()

            await interactionManager.safeReply(interaction, { embeds: [supportEmbed] })

            // Mensagem inicial no thread
            const threadWelcomeEmbed = new EmbedBuilder()
              .setTitle("🎧 Suporte - Processo Seletivo")
              .setDescription(`Olá, ${interaction.user}! Como podemos ajudá-lo?`)
              .setColor("#5F27CD")
              .addFields(
                {
                  name: "📋 Informações do Ticket",
                  value: `**ID:** ${ticketId}\n**Usuário:** ${interaction.user.tag}\n**Motivo:** Suporte - Processo Seletivo`,
                  inline: false,
                },
                {
                  name: "⏰ Tempo de Resposta",
                  value: "Nossa equipe responde em até 24 horas",
                  inline: true,
                },
                {
                  name: "🔒 Encerrar Ticket",
                  value: "Use o botão abaixo quando resolver sua dúvida",
                  inline: true,
                },
              )
              .setFooter({ text: "iCloud Bot • Sistema de Suporte" })
              .setTimestamp()

            const closeButton = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("encerrar_ticket")
                .setLabel("🔒 Encerrar Ticket")
                .setStyle(ButtonStyle.Danger),
            )

            await thread.send({
              content: `${interaction.user}`,
              embeds: [threadWelcomeEmbed],
              components: [closeButton],
            })
          }
        } catch (error) {
          console.error("Erro ao processar resposta do convite:", error)
          await interactionManager.safeReply(interaction, {
            content: "❌ Ocorreu um erro ao processar sua resposta. Tente novamente.",
          })
        } finally {
          // Marcar como processada
          interactionManager.finishProcessing(interaction)
        }
        return
      }
    }
  },
}
