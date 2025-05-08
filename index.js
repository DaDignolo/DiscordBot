require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  SlashCommandBuilder, 
  REST, 
  Routes, 
  PermissionsBitField, 
  MessageFlags
} = require('discord.js');
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
const GOD_ID = '183596970366074880';

// DEFINIZIONE COMANDI CON PERMESSI
const commands = [
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banna un utente')
    .addUserOption(option =>
      option.setName('utente')
        .setDescription('Utente da bannare')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Espelli un utente')
    .addUserOption(option =>
      option.setName('utente')
        .setDescription('Utente da espellere')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers),

  new SlashCommandBuilder()
    .setName('freestuff')
    .setDescription('Mostra giochi gratis attuali')
    .setDefaultMemberPermissions(0),

  new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Disconnette un utente dal canale vocale')
    .addUserOption(option =>
      option.setName('utente')
        .setDescription('Utente da disconnettere')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.MoveMembers)
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);
// Log di start
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

client.once('ready', () => {
  console.log('✅ Bot è online!');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'ban') {
    const user = interaction.options.getUser('utente');
    const member = interaction.guild.members.cache.get(user.id);

    if (user.id === GOD_ID) {
      return interaction.reply({ content: 'Non posso bannare il mio pet', ephemeral: true});
    }

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
    // Solo amministratori (controllo extra)
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Solo gli amministratori possono usare questo comando.', ephemeral: true });
    }
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
  
    if (user.id === GOD_ID) {
      return await interaction.reply({ content: 'Non puoi disconnettere questo utente.', flags: MessageFlags.Ephemeral });
    }
  
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.MoveMembers)) {
      return await interaction.reply({ content: 'Non hai il permesso di disconnettere utenti dai canali vocali.', flags: MessageFlags.Ephemeral });
    }
  
    if (!member || !member.voice.channel) {
      return await interaction.reply({ content: 'Questo utente non è in un canale vocale.', flags: MessageFlags.Ephemeral });
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
  if (message.content.toLowerCase() === 'woof woof') {
    message.reply(`Good boy`);
  }
});

client.login(TOKEN);
