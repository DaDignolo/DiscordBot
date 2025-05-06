require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionsBitField } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

client.once('ready', () => {
  console.log('✅ Bot è online!');
});

const commands = [
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banna un utente')
    .addUserOption(option =>
      option.setName('utente')
        .setDescription('Utente da bannare')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Espelli un utente')
    .addUserOption(option =>
      option.setName('utente')
        .setDescription('Utente da espellere')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('freestuff')
    .setDescription('Mostra giochi gratis attuali'),
  new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Disconnette un utente dal canale vocale')
    .addUserOption(option =>
      option.setName('utente')
      .setDescription('Utente da disconnettere')
      .setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Comandi registrati!');
  } catch (error) {
    console.error('❌ Errore nella registrazione comandi:', error);
  }
})();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'ban') {
    const user = interaction.options.getUser('utente');
    const member = interaction.guild.members.cache.get(user.id);

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: 'Non hai il permesso di bannare utenti', ephemeral: true });
    }

    if (!member || !member.bannable) {
      return interaction.reply('Non posso bannare questo utente.');
    }

    await member.ban();
    interaction.reply(`Utente **${user.tag}** è stato bannato.`);
  }

  if (commandName === 'kick') {
    const user = interaction.options.getUser('utente');
    const member = interaction.guild.members.cache.get(user.id);

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({ content: 'Non hai il permesso di espellere utenti', ephemeral: true });
    }

    if (!member || !member.kickable) {
      return interaction.reply('Non posso espellere questo utente.');
    }

    await member.kick();
    interaction.reply(`Utente **${user.tag}** è stato espulso.`);
  }

  if (commandName === 'freestuff') {
    try {
      await interaction.reply({ content: 'Sto cercando giochi gratuiti...' });

      const res = await axios.get('https://www.cheapshark.com/api/1.0/deals', {
        params: {
          storeID: 4,
          upperPrice: 0,
          pageSize: 1,
          sortBy: 'Savings'
        }
      });

      const games = res.data;

      if (games.length === 0) {
        interaction.editReply('Nessun gioco gratuito trovato al momento.');
      } else {
        const reply = games.map(game => {
          return `🎮 [${game.title}](${game.dealID ? `https://www.cheapshark.com/redirect?dealID=${game.dealID}` : game.steamAppID ? `https://store.steampowered.com/app/${game.steamAppID}` : '#'}) - **${game.storeID === "1" ? "Steam" : "Store"}**`;
        }).join('\n');

        interaction.editReply(`Ecco alcuni giochi gratuiti trovati:\n\n${reply}`);
      }
    } catch (error) {
      console.error(error);
      interaction.editReply('Errore nel recupero dei giochi gratuiti.');
    }
  }

  if (commandName === 'disconnect') {
    const user = interaction.options.getUser('utente');
    const member = interaction.guild.members.cache.get(user.id);
  
    if (!member || !member.voice.channel) {
      return interaction.reply('Questo utente non è in un canale vocale.');
    }
  
    try {
      await member.voice.disconnect();
      await interaction.reply(`Utente **${user.tag}** disconnesso dal canale vocale.`);
    } catch (err) {
      await interaction.reply('Non posso disconnettere questo utente.');
    }
  }
  
});

// Risposta automatica
client.on('messageCreate', message => {
  if (message.author.bot) return;

  if (message.content.toLowerCase() === 'hi mommy') {
    message.reply(`Hi ${message.author}, now bark for me`);
  }
});

client.on('messageCreate', message => {
  if (message.author.bot) return;

  if (message.content.toLowerCase() === 'woof woof') {
    message.reply(`Good boy`);
  }
});

client.login(TOKEN);