require('dotenv').config();
const { Manager } = require('erela.js');
const { 
  Client, 
  GatewayIntentBits, 
  SlashCommandBuilder, 
  REST, 
  Routes, 
  PermissionsBitField, 
  MessageFlags,
  MessageActivityType
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
const SPAM_CHANNEL_ID = '1370906498414411796';

const manager = new Manager({
  nodes: [
    {
      host: 'lavalink-pmh4.onrender.com',
      port: 80,
      password: process.env.PASS_LAVA
    }
  ],
  send(id, payload) {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  }
});

// Register slash commands
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
    .setDefaultMemberPermissions(PermissionsBitField.Flags.MoveMembers),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Cancella messaggi nel canale')
    .addIntegerOption(option =>
      option.setName('numero')
      .setDescription('Quanti messaggi vuoi cancellare (max 100)')
      .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),

  new SlashCommandBuilder()
    .setName('spam')
    .setDescription('Spam')
    .addStringOption(option =>
      option.setName('messaggio')
      .setDescription('Messaggio da spammare')
      .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('numero')
      .setDescription('Quante volte vuoi spammare')
      .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('ogur')
    .setDescription('On god you retarded')
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

client.once('ready', () => {
  console.log('✅ Bot è online!');
  manager.init(client.user.id);  // Initialize Lavalink manager
});

// Lavalink events
manager.on('nodeConnect', node => {
  console.log(`Node ${node.options.identifier} connected`);
});

manager.on('trackStart', (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send(`🎶 Now playing: **${track.title}**`);
});

manager.on('queueEnd', player => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send('Queue has ended, leaving the voice channel.');
  player.destroy();
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'ban') {
    const user = interaction.options.getUser('utente');
    const member = interaction.guild.members.cache.get(user.id);

    if (user.id === GOD_ID) {
      return await interaction.reply({ content: 'Non puoi bannare il mio pet.', flags: MessageFlags.Ephemeral });
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

    if (user.id === GOD_ID) {
      return await interaction.reply({ content: 'Non puoi Kickare il mio pet.', flags: MessageFlags.Ephemeral });
    }

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
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Solo gli amministratori possono usare questo comando.', ephemeral: true });
    }

    try {
      await interaction.reply({ content: 'Sto cercando giochi gratuiti attualmente disponibili...' });

      const res = await axios.get('https://www.gamerpower.com/api/giveaways', {
        params: {
          platform: 'pc',
          type: 'game'
        }
      });

      const games = res.data.slice(0, 5);

      if (games.length === 0) {
        interaction.editReply('Nessun gioco gratuito trovato al momento.');
      } else {
        const reply = games.map(game => {
          return `🎁 [${game.title}](${game.open_giveaway_url}) - **${game.worth}** - *${game.platforms}*`;
        }).join('\n');

        interaction.editReply(`Ecco alcune offerte gratuite attive:\n\n${reply}`);
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
      return await interaction.reply({ content: 'Non puoi disconnettere il mio pet.', flags: MessageFlags.Ephemeral });
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

  if (commandName === 'clear') {
    const amount = interaction.options.getInteger('numero');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: 'Non hai il permesso di cancellare i messaggi.', flags: MessageFlags.Ephemeral });
    }

    if (amount < 1 || amount > 100) {
      return interaction.reply({ content: 'Devi specificare un numero tra 1 e 100.', flags: MessageFlags.Ephemeral });
    }

    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.reply({ content: `Ho cancellato ${deleted.size} messaggi.`, flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Errore nella cancellazione dei messaggi. Controlla che i messaggi non siano piú vecchi di 14 giorni', flags: MessageFlags.Ephemeral });
    }
  }

  if (commandName === 'ogur') {
    await interaction.reply(':point_right::pray::index_pointing_at_the_viewer::zany_face:');
  }

  if (commandName === 'spam') {
    const spamchannel = interaction.guild.channels.cache.get(SPAM_CHANNEL_ID);
    const requiredRole = 'Spam Certified';
    const member = interaction.member;

    const hasRole = member.roles.cache.some(role => role.name === requiredRole);

    if (!hasRole) {
      await interaction.reply({ content: 'Non hai il permesso di usare questo comando', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!spamchannel) {
      return await interaction.reply({ content: 'Canale non trovato', flags: MessageFlags.Ephemeral });
    }

    const messaggio = interaction.options.getString('messaggio');
    let volte = interaction.options.getInteger('numero');

    if (volte > 50) volte = 50;

    await interaction.reply({ content: `Sto spammando il messaggio ${messaggio}, ${volte} volte`, flags: MessageFlags.Ephemeral });

    for (let i = 0; i < volte; i++) {
      await spamchannel.send(messaggio);
      await new Promise(res => setTimeout(res, 700));
    }
  }
});

// Music play command using message commands
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Basic greeting responses (keep these)
  if (message.content.toLowerCase() === 'hi mommy') {
    message.reply(`Hi ${message.author}, now bark for me`);
    return;
  }
  if (message.content.toLowerCase() === 'woof woof') {
    message.reply(`Good boy`);
    return;
  }

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'play') {
    if (!args.length) return message.channel.send('Please provide a song name or URL!');

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!');

    // Create or get player for the guild
    let player = manager.players.get(message.guild.id);
    if (!player) {
      player = manager.create({
        guild: message.guild.id,
        voiceChannel: voiceChannel.id,
        textChannel: message.channel.id,
        selfDeafen: true
      });
    } else {
      if (player.voiceChannel !== voiceChannel.id) player.setVoiceChannel(voiceChannel.id);
      player.setTextChannel(message.channel.id);
    }

    if (player.state !== 'CONNECTED') await player.connect();

    const search = args.join(' ');
    const res = await manager.search(search, message.author);

    if (res.loadType === 'NO_MATCHES') {
      return message.channel.send(`No results found for **${search}**.`);
    } else if (res.loadType === 'LOAD_FAILED') {
      return message.channel.send('Failed to load the track, please try again later.');
    }

    if (res.loadType === 'PLAYLIST_LOADED') {
      player.queue.add(res.tracks);
      message.channel.send(`Playlist **${res.playlist.name}** added to the queue!`);
    } else {
      player.queue.add(res.tracks[0]);
      message.channel.send(`Track **${res.tracks[0].title}** added to the queue!`);
    }

    if (!player.playing && !player.paused) player.play();
  }
});

client.login(TOKEN);
