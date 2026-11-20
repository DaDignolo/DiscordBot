require('dotenv').config();
const { Manager } = require('erela.js');
const {
  Client,
  Events,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField
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
      port: 443, // Render serves over HTTPS on 443
      password: process.env.PASS_LAVA,
      secure: true
    }
  ],
  send(id, payload) {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  }
});

// REQUIRED: forward raw gateway events so Erela can join voice channels
client.on('raw', d => manager.updateVoiceState(d));

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
    .setDescription('On god you retarded'),

  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube or URL')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Name or URL of the song to play')
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

// Events.ClientReady works on both older ('ready') and newer ('clientReady') discord.js v14
client.once(Events.ClientReady, () => {
  console.log('Client ready');
  manager.init(client.user.id);
});

// Lavalink events
manager.on('nodeConnect', node => {
  console.log(`Lavalink node "${node.options.identifier}" connected.`);
});

manager.on('nodeError', (node, error) => {
  console.error(`Lavalink node "${node.options.identifier}" encountered error: ${error.message}`);
});

manager.on('trackStart', (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send(`🎶 Now playing: **${track.title}**`);
});

manager.on('trackError', (player, track, payload) => {
  console.error('Track error:', payload);
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send(`❌ Couldn't play **${track.title}**, skipping.`);
  player.stop();
});

manager.on('trackStuck', (player, track) => {
  player.stop();
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
      return await interaction.reply({ content: 'Non puoi bannare il mio pet.', ephemeral: true });
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

  else if (commandName === 'kick') {
    const user = interaction.options.getUser('utente');
    const member = interaction.guild.members.cache.get(user.id);

    if (user.id === GOD_ID) {
      return await interaction.reply({ content: 'Non puoi Kickare il mio pet.', ephemeral: true });
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

  else if (commandName === 'freestuff') {
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

  else if (commandName === 'disconnect') {
    const user = interaction.options.getUser('utente');
    const member = interaction.guild.members.cache.get(user.id);

    if (user.id === GOD_ID) {
      return await interaction.reply({ content: 'Non puoi disconnettere il mio pet.', ephemeral: true });
    }

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.MoveMembers)) {
      return await interaction.reply({ content: 'Non hai il permesso di disconnettere utenti dai canali vocali.', ephemeral: true });
    }

    if (!member || !member.voice.channel) {
      return await interaction.reply({ content: 'Questo utente non è in un canale vocale.', ephemeral: true });
    }

    try {
      await member.voice.disconnect();
      await interaction.reply(`Utente **${user.tag}** disconnesso dal canale vocale.`);
    } catch (err) {
      await interaction.reply('Non posso disconnettere questo utente.');
    }
  }

  else if (commandName === 'clear') {
    const amount = interaction.options.getInteger('numero');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: 'Non hai il permesso di cancellare i messaggi.', ephemeral: true });
    }

    if (amount < 1 || amount > 100) {
      return interaction.reply({ content: 'Devi specificare un numero tra 1 e 100.', ephemeral: true });
    }

    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.reply({ content: `Ho cancellato ${deleted.size} messaggi.`, ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Errore nella cancellazione dei messaggi. Controlla che i messaggi non siano piú vecchi di 14 giorni', ephemeral: true });
    }
  }

  else if (commandName === 'ogur') {
    await interaction.reply(':point_right::pray::index_pointing_at_the_viewer::zany_face:');
  }

  else if (commandName === 'spam') {
    const spamchannel = interaction.guild.channels.cache.get(SPAM_CHANNEL_ID);
    const requiredRole = 'Spam Certified';
    const member = interaction.member;

    const hasRole = member.roles.cache.some(role => role.name === requiredRole);

    if (!hasRole) {
      await interaction.reply({ content: 'Non hai il permesso di usare questo comando', ephemeral: true });
      return;
    }

    if (!spamchannel) {
      return await interaction.reply({ content: 'Canale non trovato', ephemeral: true });
    }

    const messaggio = interaction.options.getString('messaggio');
    let volte = interaction.options.getInteger('numero');

    if (volte > 50) volte = 50;

    await interaction.reply({ content: `Sto spammando il messaggio ${messaggio}, ${volte} volte`, ephemeral: true });

    for (let i = 0; i < volte; i++) {
      await spamchannel.send(messaggio);
      await new Promise(res => setTimeout(res, 700));
    }
  }

  else if (commandName === 'play') {
    try {
      const query = interaction.options.getString('query');
      const voiceChannel = interaction.member.voice.channel;

      if (!voiceChannel) {
        return await interaction.reply({ content: 'You must be in a voice channel!', ephemeral: true });
      }

      await interaction.deferReply();

      const node = manager.nodes.first();
      if (!node || !node.connected) {
        return await interaction.editReply('❌ Lavalink node is not connected.');
      }

      let player = manager.players.get(interaction.guild.id);
      if (!player) {
        player = manager.create({
          guild: interaction.guild.id,
          voiceChannel: voiceChannel.id,
          textChannel: interaction.channel.id,
          selfDeafen: true,
        });
      }

      if (player.state !== 'CONNECTED') player.connect();

      const res = await manager.search(query, interaction.user);

      if (res.loadType === 'NO_MATCHES') {
        return await interaction.editReply(`❌ No results found for \`${query}\`.`);
      }

      if (res.loadType === 'LOAD_FAILED') {
        console.error('Load failed:', res.exception);
        return await interaction.editReply('❌ Failed to load the track.');
      }

      if (res.loadType === 'PLAYLIST_LOADED') {
        player.queue.add(res.tracks);
        await interaction.editReply(`✅ Playlist **${res.playlist.name}** added with ${res.tracks.length} tracks.`);
      } else {
        player.queue.add(res.tracks[0]);
        await interaction.editReply(`✅ Track **${res.tracks[0].title}** added to queue.`);
      }

      if (!player.playing && !player.paused) player.play();

    } catch (error) {
      console.error('Error in /play command:', error);
      const msg = '❌ An error occurred while playing the track.';
      try {
        if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
        else await interaction.reply({ content: msg, ephemeral: true });
      } catch (e) {
        console.error('Failed to send error reply:', e);
      }
    }
  }
});

client.login(TOKEN);