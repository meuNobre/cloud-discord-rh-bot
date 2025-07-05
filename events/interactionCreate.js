const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} = require("discord.js")
const { processTicketClosure } = require("../utils/ticketHistory")
const {
  safeInteractionReply,
  safeInteractionUpdate,
  safeShowModal,
  isInteractionValid,
  isThreadAccessible,
  createErrorEmbed,
  createWarningEmbed,
} = require("./interactionHandler")

// Debug logs
function logInteraction(interaction, context) {
  console.log(`🔍 [${context}] Interação detectada:`)
  console.log(`   👤 Usuário: ${interaction.user.tag}`)
  console.log(`   🆔 Custom ID: ${interaction.customId}`)
  console.log(
    `   📍 Tipo: ${interaction.isButton() ? "Button" : interaction.isStringSelectMenu() ? "SelectMenu" : "Other"}`,
  )
  console.log(`   🌐 Canal: ${interaction.channel?.type || "DM"}`)
  console.log(`   ⏰ Idade: ${Date.now() - interaction.createdTimestamp}ms`)
}

// IDs fixos
const GUILD_ID = "1245886288591196180"
const SUPORTE_CHANNEL_ID = "1250899735607513130"

// Cores do tema
const COLORS = {
  PRIMARY: "#00D9FF",
  SUCCESS: "#00FF88",
  ERROR: "#FF4757",
  WARNING: "#FFA502",
  SECONDARY: "#5F27CD",
  DARK: "#2C2C54",
}

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    // Verificar se a interação ainda é válida
    const interactionAge = Date.now() - interaction.createdTimestamp
    if (interactionAge > 2500) {
      console.warn(`⚠️ Interação expirada (${interactionAge}ms): ${interaction.customId}`)
      return
    }

    // Log de debug
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      logInteraction(interaction, "MAIN_HANDLER")
    }

    // Acessa o sistema de tickets global
    const { activeTickets, threadUsers, database } = global.ticketSystem

    // ===== COMANDO SLASH =====
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName)

      if (!command) {
        console.error(`Nenhum comando encontrado: ${interaction.commandName}`)
        return
      }

      try {
        await command.execute(interaction)
      } catch (error) {
        console.error(`Erro ao executar comando ${interaction.commandName}:`, error)

        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("❌ Erro")
          .setDescription("Houve um erro ao executar este comando.")
          .setTimestamp()

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errorEmbed], ephemeral: true })
        } else {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
        }
      }
      return
    }

    // ===== SISTEMA DE CONVITES =====
    if (interaction.isButton()) {
      const customId = interaction.customId

      // Botões de resposta ao convite
      if (["sim", "nao", "suporte"].includes(customId)) {
        try {
          await interaction.deferReply({ ephemeral: true })

          const userId = interaction.user.id
          const messageId = interaction.message.id

          // Buscar convite no banco
          const invite = await database.getInviteStatus(userId, messageId)
          if (!invite) {
            await interaction.editReply({
              content: "❌ Convite não encontrado ou já processado.",
            })
            return
          }

          if (invite.status !== "pending") {
            await interaction.editReply({
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
              await interaction.editReply({
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

              await interaction.editReply({
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
              await interaction.editReply({
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

            await interaction.editReply({ embeds: [declineEmbed] })

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
              await interaction.editReply({
                content: `⚠️ Você já possui um ticket ativo: <#${existingTicket.thread_id}>`,
              })
              return
            }

            // Criar thread de suporte
            const guild = interaction.client.guilds.cache.get(GUILD_ID)
            const supportChannel = guild?.channels.cache.get(SUPORTE_CHANNEL_ID)

            if (!supportChannel) {
              await interaction.editReply({
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

            await interaction.editReply({ embeds: [supportEmbed] })

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
          try {
            await interaction.editReply({
              content: "❌ Ocorreu um erro ao processar sua resposta. Tente novamente.",
            })
          } catch (replyError) {
            console.error("Erro ao responder com erro:", replyError)
          }
        }
        return
      }

      // ===== SISTEMA DE TICKETS =====
      if (customId === "encerrar_ticket") {
        try {
          const threadId = interaction.channelId
          const userId = threadUsers.get(threadId)

          if (!userId) {
            await interaction.reply({
              content: "❌ Ticket não encontrado no sistema.",
              ephemeral: true,
            })
            return
          }

          // Verificar se o usuário pode fechar o ticket
          if (interaction.user.id !== userId && !interaction.member.permissions.has("ManageChannels")) {
            await interaction.reply({
              content: "❌ Você não tem permissão para fechar este ticket.",
              ephemeral: true,
            })
            return
          }

          // Buscar dados do ticket para o histórico
          const ticket = await database.getTicketByThread(threadId)
          if (!ticket) {
            await interaction.reply({
              content: "❌ Ticket não encontrado no banco de dados.",
              ephemeral: true,
            })
            return
          }

          if (ticket.status === "closed") {
            await interaction.reply({
              content: "❌ Este ticket já está fechado.",
              ephemeral: true,
            })
            return
          }

          // Criar embed de confirmação com countdown
          const confirmEmbed = new EmbedBuilder()
            .setTitle("⚠️ Confirmar Encerramento")
            .setDescription(
              `**Encerrando ticket em 10 segundos...**

🎫 **Ticket:** #${ticket.id}
👤 **Usuário:** ${ticket.username}
📝 **Assunto:** ${ticket.reason.slice(0, 100)}...`,
            )
            .setColor("#FF6B6B")
            .addFields(
              {
                name: "📋 O que acontecerá:",
                value:
                  "• O tópico será excluído permanentemente\n• O histórico será salvo no banco de dados\n• O usuário será notificado\n• Log será enviado para o canal de logs\n• Esta ação não pode ser desfeita",
                inline: false,
              },
              {
                name: "⏰ Tempo Restante",
                value: "**10 segundos**",
                inline: true,
              },
            )
            .setFooter({ text: "iCloud Bot • Sistema de Tickets" })
            .setTimestamp()

          const confirmButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`cancel_ticket_deletion_${threadId}`)
              .setLabel("❌ Cancelar Encerramento")
              .setStyle(ButtonStyle.Danger),
          )

          const confirmMessage = await interaction.reply({
            embeds: [confirmEmbed],
            components: [confirmButtons],
            fetchReply: true,
          })

          // Countdown de 10 segundos
          let timeLeft = 10
          const cancelled = false

          const countdownInterval = setInterval(async () => {
            timeLeft--

            if (cancelled) {
              clearInterval(countdownInterval)
              return
            }

            if (timeLeft <= 0) {
              clearInterval(countdownInterval)

              try {
                // Processar encerramento completo do ticket
                const summary = await processTicketClosure(interaction.client, database, threadId, interaction.user.id)

                // Remover do sistema global
                activeTickets.delete(userId)
                threadUsers.delete(threadId)

                // Notificar usuário via DM
                try {
                  const user = await interaction.client.users.fetch(userId)
                  const dmEmbed = new EmbedBuilder()
                    .setTitle("🎫 Ticket Encerrado")
                    .setDescription("Seu ticket de suporte foi encerrado.")
                    .setColor("#00FF88")
                    .addFields(
                      {
                        name: "👤 Encerrado por",
                        value: `${interaction.user.tag}`,
                        inline: true,
                      },
                      {
                        name: "🎫 Ticket ID",
                        value: `#${ticket.id}`,
                        inline: true,
                      },
                      {
                        name: "💙 Agradecimento",
                        value: "Obrigado por entrar em contato conosco!",
                        inline: false,
                      },
                    )
                    .setFooter({ text: "iCloud Bot • Sistema de Suporte" })
                    .setTimestamp()

                  await user.send({ embeds: [dmEmbed] })
                } catch (dmError) {
                  console.error("❌ Erro ao enviar DM:", dmError)
                }

                // Atualizar mensagem de confirmação
                const closedEmbed = new EmbedBuilder()
                  .setTitle("✅ Ticket Encerrado")
                  .setDescription("O ticket foi encerrado com sucesso!")
                  .setColor("#00FF88")
                  .addFields(
                    {
                      name: "📋 Resumo",
                      value: `**Ticket:** #${ticket.id}\n**Usuário:** ${ticket.username}\n**Duração:** ${summary.resolution_time_minutes} minutos\n**Mensagens:** ${summary.total_messages}`,
                      inline: false,
                    },
                    {
                      name: "📋 Log Enviado",
                      value: "O histórico completo foi enviado para o canal de logs",
                      inline: false,
                    },
                  )
                  .setTimestamp()

                await confirmMessage.edit({
                  embeds: [closedEmbed],
                  components: [],
                })

                // Deletar thread após 3 segundos
                setTimeout(async () => {
                  try {
                    await interaction.channel.delete()
                    console.log(`🗑️ Thread deletado: ${threadId} - Ticket #${ticket.id}`)
                  } catch (deleteError) {
                    console.error("❌ Erro ao deletar thread:", deleteError)
                  }
                }, 3000)
              } catch (error) {
                console.error("Erro ao encerrar ticket:", error)

                const errorEmbed = new EmbedBuilder()
                  .setTitle("❌ Erro ao Encerrar")
                  .setDescription("Erro ao encerrar o ticket.")
                  .setColor("#FF4757")
                  .setTimestamp()

                await confirmMessage.edit({
                  embeds: [errorEmbed],
                  components: [],
                })
              }
            } else {
              // Atualizar countdown
              const updatedEmbed = new EmbedBuilder()
                .setTitle("⚠️ Confirmar Encerramento")
                .setDescription(
                  `**Encerrando ticket em ${timeLeft} segundos...**

🎫 **Ticket:** #${ticket.id}
👤 **Usuário:** ${ticket.username}
📝 **Assunto:** ${ticket.reason.slice(0, 100)}...`,
                )
                .setColor(timeLeft <= 3 ? "#FF0000" : "#FF6B6B")
                .addFields(
                  {
                    name: "📋 O que acontecerá:",
                    value:
                      "• O tópico será excluído permanentemente\n• O histórico será salvo no banco de dados\n• O usuário será notificado\n• Log será enviado para o canal de logs\n• Esta ação não pode ser desfeita",
                    inline: false,
                  },
                  {
                    name: "⏰ Tempo Restante",
                    value: `**${timeLeft} segundos**`,
                    inline: true,
                  },
                )
                .setFooter({ text: "iCloud Bot • Sistema de Tickets" })
                .setTimestamp()

              try {
                await confirmMessage.edit({
                  embeds: [updatedEmbed],
                  components: [confirmButtons],
                })
              } catch (editError) {
                // Ignorar erros de edição (mensagem pode ter sido deletada)
              }
            }
          }, 1000)

          // Armazenar o interval para poder cancelar
          global.ticketDeletionIntervals = global.ticketDeletionIntervals || new Map()
          global.ticketDeletionIntervals.set(threadId, countdownInterval)
        } catch (error) {
          console.error("Erro ao processar fechamento de ticket:", error)
          try {
            await interaction.reply({
              content: "❌ Ocorreu um erro ao processar o fechamento do ticket.",
              ephemeral: true,
            })
          } catch (replyError) {
            console.error("Erro ao responder com erro:", replyError)
          }
        }
        return
      }

      // Botão CANCELAR ENCERRAMENTO DE TICKET
      if (customId.startsWith("cancel_ticket_deletion_")) {
        const threadId = customId.split("_")[3]

        // Cancelar o countdown
        if (global.ticketDeletionIntervals && global.ticketDeletionIntervals.has(threadId)) {
          clearInterval(global.ticketDeletionIntervals.get(threadId))
          global.ticketDeletionIntervals.delete(threadId)
        }

        const cancelledEmbed = new EmbedBuilder()
          .setTitle("✅ Encerramento Cancelado")
          .setDescription("O encerramento do ticket foi cancelado com sucesso.")
          .setColor("#00FF88")
          .addFields({
            name: "💡 Informação",
            value: "O ticket continua ativo e você pode continuar a conversa normalmente.",
            inline: false,
          })
          .setFooter({ text: "iCloud Bot • Sistema de Tickets" })
          .setTimestamp()

        await safeInteractionUpdate(interaction, {
          embeds: [cancelledEmbed],
          components: [],
        })

        console.log(`❌ Encerramento de ticket cancelado: ${threadId}`)
        return
      }

      // Botão FINALIZAR ENTREVISTA
      if (customId.startsWith("finish_interview_")) {
        const interviewId = Number.parseInt(customId.split("_")[2])

        const modal = new ModalBuilder().setCustomId(`end_interview_${interviewId}`).setTitle("🎤 Finalizar Entrevista")

        const resultInput = new TextInputBuilder()
          .setCustomId("result")
          .setLabel("Resultado (aprovado/rejeitado)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("aprovado ou rejeitado")
          .setRequired(true)

        const scoreInput = new TextInputBuilder()
          .setCustomId("score")
          .setLabel("Nota (0-10)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Nota de 0 a 10")
          .setRequired(true)

        const commentsInput = new TextInputBuilder()
          .setCustomId("comments")
          .setLabel("Comentários da Entrevista")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Descreva como foi a entrevista...")
          .setRequired(false)

        const feedbackInput = new TextInputBuilder()
          .setCustomId("feedback")
          .setLabel("Feedback para o Candidato")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Feedback que será enviado ao candidato...")
          .setRequired(false)

        modal.addComponents(
          new ActionRowBuilder().addComponents(resultInput),
          new ActionRowBuilder().addComponents(scoreInput),
          new ActionRowBuilder().addComponents(commentsInput),
          new ActionRowBuilder().addComponents(feedbackInput),
        )

        await safeShowModal(interaction, modal)
        return
      }

      // Botão CONFIRMAR ENTRADA
      if (customId.startsWith("confirm_entry_")) {
        const parts = customId.split("_")
        const targetUserId = parts[2]
        const originalMessageId = parts[3]

        if (interaction.user.id !== targetUserId) {
          const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Acesso Negado")
            .setDescription("Você não pode confirmar a entrada de outro usuário.")
            .setColor("#FF4757")
            .setTimestamp()

          await safeInteractionReply(interaction, { embeds: [errorEmbed], ephemeral: true })
          return
        }

        try {
          await database.updateInviteStatus(targetUserId, originalMessageId, "entered")

          const inviteData = await database.getInviteStatus(targetUserId, originalMessageId)

          const activeProcess = await database.getActiveProcess()
          if (activeProcess) {
            const participants = await database.getProcessParticipants(activeProcess.id)
            const participant = participants.find((p) => p.user_id === targetUserId)

            if (participant) {
              await database.updateParticipantStatus(participant.id, "accepted", "ready_for_interview")
            }
          }

          if (inviteData && inviteData.confirmation_message_id && inviteData.confirmation_channel_id) {
            try {
              const channel = await interaction.client.channels.fetch(inviteData.confirmation_channel_id)
              const originalMessage = await channel.messages.fetch(inviteData.confirmation_message_id)

              const updatedEmbed = new EmbedBuilder()
                .setTitle("✅ Convite Enviado com Sucesso!")
                .setDescription(`O convite foi enviado para **${interaction.user.tag}**`)
                .setColor("#00FF88")
                .addFields(
                  {
                    name: "👤 Candidato",
                    value: `${interaction.user.tag}`,
                    inline: true,
                  },
                  {
                    name: "📅 Enviado em",
                    value: `<t:${Math.floor(new Date(inviteData.sent_at).getTime() / 1000)}:F>`,
                    inline: true,
                  },
                  {
                    name: "✅ Confirmado em",
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                    inline: true,
                  },
                  {
                    name: "📊 Status",
                    value: "✅ **ACEITO E CONFIRMADO**",
                    inline: false,
                  },
                  {
                    name: "🎯 Próximo Passo",
                    value: "Candidato pronto para entrevista",
                    inline: true,
                  },
                  {
                    name: "💾 Sistema",
                    value: "✅ Atualizado!",
                    inline: true,
                  },
                )
                .setFooter({ text: "iCloud Bot • Sistema de Recrutamento" })
                .setTimestamp()
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))

              await originalMessage.edit({ embeds: [updatedEmbed] })
              console.log(`📝 Embed original atualizada para ${interaction.user.tag}`)
            } catch (editError) {
              console.error("Erro ao atualizar embed original:", editError)
            }
          }

          const confirmEmbed = new EmbedBuilder()
            .setTitle("🎉 Entrada Confirmada!")
            .setDescription("Perfeito! Sua entrada no servidor foi confirmada com sucesso!")
            .setColor("#00FF88")
            .addFields(
              {
                name: "✅ Status Atualizado",
                value: "Seu status foi atualizado para **Aceito** em nosso sistema",
                inline: false,
              },
              {
                name: "🎯 Próximos Passos",
                value: "Nossa equipe entrará em contato em breve para agendar sua entrevista",
                inline: false,
              },
              {
                name: "📞 Aguarde Contato",
                value: "Fique atento às suas DMs para informações sobre a entrevista",
                inline: false,
              },
              {
                name: "💡 Dica",
                value: "Mantenha suas DMs abertas para receber atualizações do processo",
                inline: false,
              },
            )
            .setFooter({ text: "iCloud Bot • Processo Seletivo" })
            .setTimestamp()

          await safeInteractionUpdate(interaction, {
            embeds: interaction.message.embeds,
            components: [],
          })

          await interaction.followUp({
            embeds: [confirmEmbed],
            ephemeral: true,
          })

          console.log(`✅ Entrada confirmada: User ${targetUserId} - Status atualizado para 'entered'`)
        } catch (error) {
          console.error("Erro ao confirmar entrada:", error)

          const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Erro na Confirmação")
            .setDescription("Ocorreu um erro ao confirmar sua entrada. Tente novamente.")
            .setColor("#FF4757")
            .setTimestamp()

          await safeInteractionReply(interaction, { embeds: [errorEmbed], ephemeral: true })
        }
        return
      }

      // Botões de resposta ao convite (novo sistema)
      if (customId.startsWith("invite_accept_") || customId.startsWith("invite_decline_")) {
        try {
          await interaction.deferReply({ ephemeral: true })

          const isAccepting = customId.startsWith("invite_accept_")
          const parts = customId.split("_")
          const userId = parts[2]
          const messageId = parts[3]

          // Verificar se é o usuário correto
          if (interaction.user.id !== userId) {
            return await interaction.editReply({
              content: "❌ Este convite não é para você!",
              ephemeral: true,
            })
          }

          // Buscar convite no banco
          const invite = await database.getInviteStatus(userId, interaction.message.id)
          if (!invite) {
            return await interaction.editReply({
              content: "❌ Convite não encontrado ou já processado.",
              ephemeral: true,
            })
          }

          if (invite.status !== "pending") {
            return await interaction.editReply({
              content: `❌ Este convite já foi ${invite.status === "accepted" ? "aceito" : "recusado"}.`,
              ephemeral: true,
            })
          }

          // Verificar se não expirou
          const now = new Date()
          const expiresAt = new Date(invite.expires_at)
          if (now > expiresAt) {
            await database.updateInviteStatus(userId, interaction.message.id, "expired")
            return await interaction.editReply({
              content: "❌ Este convite expirou.",
              ephemeral: true,
            })
          }

          if (isAccepting) {
            // Aceitar convite
            await database.updateInviteStatus(userId, interaction.message.id, "accepted")

            const acceptEmbed = new EmbedBuilder()
              .setTitle("✅ Convite Aceito!")
              .setDescription("Você aceitou o convite para o processo seletivo.")
              .addFields(
                { name: "📋 Próximos Passos", value: "Aguarde instruções da equipe de recrutamento.", inline: false },
                { name: "🎯 Status", value: "Convite aceito - Aguardando próximas etapas", inline: true },
              )
              .setColor("#00ff00")
              .setTimestamp()

            const inviteRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`generate_invite_${userId}_${interaction.message.id}`)
                .setLabel("🔗 Gerar Convite do Discord")
                .setStyle(ButtonStyle.Primary),
            )

            await interaction.editReply({
              embeds: [acceptEmbed],
              components: [inviteRow],
              ephemeral: true,
            })

            // Desabilitar botões da mensagem original
            const disabledRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("disabled_accept")
                .setLabel("✅ Aceito")
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId("disabled_decline")
                .setLabel("❌ Recusar")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            )

            await interaction.message.edit({
              components: [disabledRow],
            })
          } else {
            // Recusar convite
            await database.updateInviteStatus(userId, interaction.message.id, "declined")

            const declineEmbed = new EmbedBuilder()
              .setTitle("❌ Convite Recusado")
              .setDescription("Você recusou o convite para o processo seletivo.")
              .addFields({
                name: "📝 Observação",
                value: "Você pode ser convidado novamente no futuro.",
                inline: false,
              })
              .setColor("#ff0000")
              .setTimestamp()

            await interaction.editReply({
              embeds: [declineEmbed],
              ephemeral: true,
            })

            // Desabilitar botões da mensagem original
            const disabledRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("disabled_accept")
                .setLabel("✅ Aceitar")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId("disabled_decline")
                .setLabel("❌ Recusado")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true),
            )

            await interaction.message.edit({
              components: [disabledRow],
            })
          }

          console.log(`✅ Convite ${isAccepting ? "aceito" : "recusado"} por ${interaction.user.username}`)
        } catch (error) {
          console.error("❌ Erro ao processar resposta do convite:", error)

          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "❌ Erro ao processar sua resposta.",
              ephemeral: true,
            })
          } else {
            await interaction.editReply({
              content: "❌ Erro ao processar sua resposta.",
            })
          }
        }
        return
      }

      // Botão GERAR CONVITE DO DISCORD
      if (customId.startsWith("generate_invite_")) {
        try {
          await interaction.deferReply({ ephemeral: true })

          const parts = customId.split("_")
          const userId = parts[2]
          const messageId = parts[3]

          // Verificar se é o usuário correto
          if (interaction.user.id !== userId) {
            return await interaction.editReply({
              content: "❌ Esta ação não é para você!",
              ephemeral: true,
            })
          }

          // Buscar convite
          const invite = await database.getInviteStatus(userId, messageId)
          if (!invite || invite.status !== "accepted") {
            return await interaction.editReply({
              content: "❌ Você precisa aceitar o convite primeiro.",
              ephemeral: true,
            })
          }

          // Gerar convite do Discord
          try {
            const guild = interaction.client.guilds.cache.first() // Pega o primeiro servidor
            if (!guild) {
              return await interaction.editReply({
                content: "❌ Erro: Servidor não encontrado.",
                ephemeral: true,
              })
            }

            const inviteLink = await guild.invites.create(guild.systemChannelId || guild.channels.cache.first(), {
              maxAge: 86400, // 24 horas
              maxUses: 1,
              unique: true,
              reason: `Convite gerado para ${interaction.user.username} - Processo Seletivo`,
            })

            // Salvar URL do convite
            await database.updateInviteStatus(userId, messageId, "accepted", inviteLink.url)

            const inviteEmbed = new EmbedBuilder()
              .setTitle("🔗 Convite do Discord Gerado")
              .setDescription(`Aqui está seu convite personalizado para entrar no servidor:`)
              .addFields(
                { name: "🔗 Link do Convite", value: `[Clique aqui para entrar](${inviteLink.url})`, inline: false },
                { name: "⏰ Validade", value: "24 horas", inline: true },
                { name: "👥 Usos", value: "1 uso apenas", inline: true },
                { name: "⚠️ Importante", value: "Este convite é exclusivo para você. Não compartilhe!", inline: false },
              )
              .setColor("#00ff00")
              .setTimestamp()

            await interaction.editReply({
              embeds: [inviteEmbed],
              ephemeral: true,
            })

            console.log(`✅ Convite do Discord gerado para ${interaction.user.username}: ${inviteLink.url}`)
          } catch (inviteError) {
            console.error("❌ Erro ao gerar convite do Discord:", inviteError)
            await interaction.editReply({
              content: "❌ Erro ao gerar convite do Discord. Tente novamente mais tarde.",
              ephemeral: true,
            })
          }
        } catch (error) {
          console.error("❌ Erro ao gerar convite:", error)
          await interaction.editReply({
            content: "❌ Erro ao processar solicitação.",
          })
        }
        return
      }

      // Botão CANCELAR CONVITE
      if (customId.startsWith("cancel_invite_")) {
        try {
          await interaction.deferReply({ ephemeral: true })

          const parts = customId.split("_")
          const targetUserId = parts[2]
          const messageId = parts[3]

          // Buscar convite
          const invite = await database.getInviteStatus(targetUserId, messageId)
          if (!invite) {
            return await interaction.editReply({
              content: "❌ Convite não encontrado.",
              ephemeral: true,
            })
          }

          if (invite.status !== "pending") {
            return await interaction.editReply({
              content: `❌ Este convite já foi ${invite.status}.`,
              ephemeral: true,
            })
          }

          // Cancelar convite
          await database.updateInviteStatus(targetUserId, messageId, "cancelled")

          await interaction.editReply({
            content: "✅ Convite cancelado com sucesso.",
            ephemeral: true,
          })

          // Tentar notificar o usuário
          try {
            const targetUser = await interaction.client.users.fetch(targetUserId)
            const cancelEmbed = new EmbedBuilder()
              .setTitle("❌ Convite Cancelado")
              .setDescription("O convite para o processo seletivo foi cancelado.")
              .setColor("#ff0000")
              .setTimestamp()

            await targetUser.send({ embeds: [cancelEmbed] })
          } catch (dmError) {
            console.log("⚠️ Não foi possível notificar o usuário sobre o cancelamento")
          }
        } catch (error) {
          console.error("❌ Erro ao cancelar convite:", error)
          await interaction.editReply({
            content: "❌ Erro ao cancelar convite.",
          })
        }
        return
      }

      // Botão SUPORTE (sistema geral)
      if (customId === "suporte") {
        try {
          const userId = interaction.user.id

          // Verificar se já tem ticket ativo
          const existingTicket = await database.getActiveTicketByUser(userId)
          if (existingTicket) {
            await interaction.reply({
              content: `⚠️ Você já possui um ticket ativo: <#${existingTicket.thread_id}>`,
              ephemeral: true,
            })
            return
          }

          // Mostrar modal para criar ticket
          const modal = new ModalBuilder().setCustomId("modalSuporte").setTitle("🎧 Criar Ticket de Suporte")

          const discordNameInput = new TextInputBuilder()
            .setCustomId("discordName")
            .setLabel("Seu nome no Discord")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Digite seu nome de usuário")
            .setRequired(true)
            .setValue(interaction.user.displayName)

          const reasonInput = new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Descreva seu problema ou dúvida")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Explique detalhadamente sua situação...")
            .setRequired(true)

          modal.addComponents(
            new ActionRowBuilder().addComponents(discordNameInput),
            new ActionRowBuilder().addComponents(reasonInput),
          )

          await safeShowModal(interaction, modal)
        } catch (error) {
          console.error("Erro ao abrir modal de suporte:", error)
          await interaction.reply({
            content: "❌ Erro ao abrir formulário de suporte.",
            ephemeral: true,
          })
        }
        return
      }

      // Botão INFO DO SERVIDOR
      if (customId === "server_info") {
        const guild = interaction.client.guilds.cache.get(GUILD_ID)
        if (!guild) {
          await interaction.reply({
            content: "❌ Informações do servidor não disponíveis.",
            ephemeral: true,
          })
          return
        }

        const infoEmbed = new EmbedBuilder()
          .setTitle("ℹ️ Informações do Servidor")
          .setDescription(`Bem-vindo ao **${guild.name}**!`)
          .addFields(
            {
              name: "👥 Membros",
              value: `${guild.memberCount} membros`,
              inline: true,
            },
            {
              name: "📅 Criado em",
              value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
              inline: true,
            },
            {
              name: "🎯 Sobre",
              value: "Servidor oficial da comunidade iCloud",
              inline: false,
            },
            {
              name: "📋 Regras Principais",
              value: "• Respeite todos os membros\n• Não faça spam\n• Mantenha conversas nos canais apropriados",
              inline: false,
            },
          )
          .setColor(COLORS.PRIMARY)
          .setThumbnail(guild.iconURL({ dynamic: true }))
          .setFooter({ text: "iCloud Bot • Informações do Servidor" })
          .setTimestamp()

        await interaction.reply({
          embeds: [infoEmbed],
          ephemeral: true,
        })
        return
      }
    }

    // ===== MODAL DE SUPORTE =====
    if (interaction.isModalSubmit() && interaction.customId === "modalSuporte") {
      const discordName = interaction.fields.getTextInputValue("discordName")
      const reason = interaction.fields.getTextInputValue("reason")
      const userId = interaction.user.id

      const guild = interaction.client.guilds.cache.get(GUILD_ID)
      const supportChannel = guild?.channels.cache.get(SUPORTE_CHANNEL_ID)

      if (!guild || !supportChannel) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Erro do Sistema")
          .setDescription("Erro ao localizar servidor ou canal de suporte.")
          .setColor("#FF4757")
          .setFooter({ text: "iCloud Bot • Sistema de Suporte" })
          .setTimestamp()

        await safeInteractionReply(interaction, { embeds: [errorEmbed], ephemeral: true })
        return
      }

      try {
        const thread = await supportChannel.threads.create({
          name: `🎧 Suporte - ${discordName}`,
          type: ChannelType.PublicThread,
          reason: `Ticket de suporte para ${interaction.user.tag}`,
        })

        const ticketId = await database.createTicket(userId, interaction.user.tag, discordName, reason, thread.id)

        activeTickets.set(userId, thread.id)
        threadUsers.set(thread.id, userId)

        console.log(`✅ Ticket criado: User ${userId} -> Thread ${thread.id} -> DB ID ${ticketId}`)

        const ticketEmbed = new EmbedBuilder()
          .setTitle("🎧 Novo Ticket de Suporte")
          .setColor("#00D9FF")
          .addFields(
            {
              name: "👤 Usuário",
              value: `<@${userId}>`,
              inline: true,
            },
            {
              name: "📝 Nome Discord",
              value: `\`${discordName}\``,
              inline: true,
            },
            {
              name: "🆔 ID do Usuário",
              value: `\`${userId}\``,
              inline: true,
            },
            {
              name: "🎫 Ticket ID",
              value: `\`${ticketId}\``,
              inline: true,
            },
            {
              name: "❓ Descrição do Problema",
              value: `\`\`\`${reason}\`\`\``,
              inline: false,
            },
          )
          .setFooter({ text: "iCloud Bot • Sistema de Suporte" })
          .setTimestamp()
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))

        const closeButton = new ButtonBuilder()
          .setCustomId("encerrar_ticket")
          .setLabel("🔒 Encerrar Ticket")
          .setStyle(ButtonStyle.Danger)

        const actionRow = new ActionRowBuilder().addComponents(closeButton)

        await thread.send({
          embeds: [ticketEmbed],
          components: [actionRow],
        })

        const confirmationEmbed = new EmbedBuilder()
          .setTitle("✅ Ticket Criado")
          .setDescription("Seu ticket de suporte foi criado com sucesso!")
          .setColor("#00FF88")
          .addFields(
            {
              name: "📋 Número do Ticket",
              value: `\`${ticketId}\``,
              inline: true,
            },
            {
              name: "🧵 Thread ID",
              value: `\`${thread.id}\``,
              inline: true,
            },
            {
              name: "⏰ Tempo de Resposta",
              value: "Nossa equipe responderá em breve",
              inline: false,
            },
            {
              name: "💬 Como Funciona",
              value: "Você pode responder diretamente aqui no DM que suas mensagens serão enviadas para a equipe!",
              inline: false,
            },
          )
          .setFooter({ text: "iCloud Bot • Sistema de Suporte" })
          .setTimestamp()

        await safeInteractionReply(interaction, { embeds: [confirmationEmbed], ephemeral: true })
      } catch (error) {
        console.error("Erro ao criar ticket:", error)

        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Erro ao Criar Ticket")
          .setDescription("Erro ao criar ticket de suporte. Tente novamente.")
          .setColor("#FF4757")
          .setFooter({ text: "iCloud Bot • Sistema de Suporte" })
          .setTimestamp()

        await safeInteractionReply(interaction, { embeds: [errorEmbed], ephemeral: true })
      }
    }

    // ===== MODAL DE FINALIZAR ENTREVISTA =====
    if (interaction.isModalSubmit() && interaction.customId.startsWith("end_interview_")) {
      const interviewId = Number.parseInt(interaction.customId.split("_")[2])
      const result = interaction.fields.getTextInputValue("result").toLowerCase()
      const score = Number.parseInt(interaction.fields.getTextInputValue("score"))
      const comments = interaction.fields.getTextInputValue("comments") || "Sem comentários"
      const feedback = interaction.fields.getTextInputValue("feedback") || "Sem feedback específico"

      if (!["aprovado", "rejeitado"].includes(result)) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Resultado Inválido")
          .setDescription("O resultado deve ser 'aprovado' ou 'rejeitado'.")
          .setColor("#FF4757")
          .setTimestamp()

        await safeInteractionReply(interaction, { embeds: [errorEmbed], ephemeral: true })
        return
      }

      if (isNaN(score) || score < 0 || score > 10) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Nota Inválida")
          .setDescription("A nota deve ser um número entre 0 e 10.")
          .setColor("#FF4757")
          .setTimestamp()

        await safeInteractionReply(interaction, { embeds: [errorEmbed], ephemeral: true })
        return
      }

      try {
        const interview = await database.getInterview(interviewId)
        if (!interview) {
          const notFoundEmbed = new EmbedBuilder()
            .setTitle("❌ Entrevista Não Encontrada")
            .setDescription("Entrevista não encontrada.")
            .setColor("#FF4757")
            .setTimestamp()

          await safeInteractionReply(interaction, { embeds: [notFoundEmbed], ephemeral: true })
          return
        }

        const endResult = await database.endInterview(interviewId, result, score, comments, feedback)

        await database.updateParticipantStatus(interview.participant_id, result, "evaluation", score, comments)

        const endEmbed = new EmbedBuilder()
          .setTitle("⏹️ Entrevista Finalizada!")
          .setDescription("A entrevista foi finalizada com sucesso!")
          .setColor("#00FF88")
          .addFields(
            {
              name: "🆔 ID da Entrevista",
              value: `\`${interviewId}\``,
              inline: true,
            },
            {
              name: "👤 Candidato",
              value: interview.participant_name,
              inline: true,
            },
            {
              name: "⏱️ Duração",
              value: `${endResult.duration} minutos`,
              inline: true,
            },
            {
              name: "📊 Resultado",
              value: result === "aprovado" ? "✅ Aprovado" : "❌ Rejeitado",
              inline: true,
            },
            {
              name: "🎯 Nota",
              value: `${score}/10`,
              inline: true,
            },
            {
              name: "💬 Comentários",
              value: comments,
              inline: false,
            },
          )
          .setFooter({ text: "iCloud Bot • Sistema de Entrevistas" })
          .setTimestamp()

        await safeInteractionReply(interaction, { embeds: [endEmbed], ephemeral: true })

        console.log(
          `⏹️ Entrevista finalizada: ID ${interviewId} - ${interview.participant_name} - Resultado: ${result}, Nota: ${score}`,
        )
      } catch (error) {
        console.error("Erro ao finalizar entrevista:", error)

        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Erro ao Finalizar")
          .setDescription("Ocorreu um erro ao finalizar a entrevista.")
          .setColor("#FF4757")
          .setTimestamp()

        await safeInteractionReply(interaction, { embeds: [errorEmbed], ephemeral: true })
      }
    }
  },
}