require('dotenv').config();
const { Shoukaku, Connectors } = require('shoukaku');
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

// ---------------------------------------------------------------------------
// Lavalink v4 (Shoukaku)
// ---------------------------------------------------------------------------
const shoukaku = new Shoukaku(
  new Connectors.DiscordJS(client),
  [
    {
      name: 'main',
      url: 'lavalink-pmh4.onrender.com:443', // host:port, no protocol
      auth: process.env.PASS_LAVA,
      secure: true // wss/https
    }
  ],
  {
    reconnectTries: 10 // the free Render service may be asleep for a while
  }
);

shoukaku.on('ready', name => console.log(`Lavalink node "${name}" connected.`));
shoukaku.on('error', (name, error) =>
  console.error(`Lavalink node "${name}" error: ${error.message}`)
);
shoukaku.on('close', (name, code, reason) =>
  console.warn(`Lavalink node "${name}" closed (${code}): ${reason}`)
);
shoukaku.on('disconnect', name => console.warn(`Lavalink node "${name}" disconnected.`));

// Per-guild playback state: { player, queue: [], playing: bool, textChannelId }
const guildStates = new Map();

function sendText(state, content) {
  const channel = client.channels.cache.get(state.textChannelId);
  if (channel) channel.send(content).catch(() => {});
}

function destroyState(guildId) {
  guildStates.delete(guildId);
  shoukaku.leaveVoiceChannel(guildId).catch(() => {});
}

async function playNext(guildId) {
  const state = guildStates.get(guildId);
  if (!state) return;

  const track = state.queue.shift();
  if (!track) {
    state.playing = false;
    sendText(state, 'Queue has ended, leaving the voice channel.');
    destroyState(guildId);
    return;
  }

  state.playing = true;
  try {
    console.log('playNext: sending track to Lavalink:', track.info.title);
    await state.player.playTrack({ track: { encoded: track.encoded } });
    console.log('playNext: playTrack resolved');
    sendText(state, `🎶 Now playing: **${track.info.title}**`);
    } catch (err) {
      console.error('playTrack failed:', err);
      sendText(state, `❌ Couldn't play **${track.info.title}**, skipping.`);
      playNext(guildId);
  }
}

function attachPlayerEvents(guildId, state) {
  const { player } = state;

  player.on('end', data => {
    // 'replaced' / 'stopped' / 'cleanup' are caused by us, not by a natural end
    if (data.reason === 'finished' || data.reason === 'loadFailed') {
      playNext(guildId);
    }
  });

  player.on('exception', data => {
    console.error('Track exception:', JSON.stringify(data, null, 2));
    sendText(state, `❌ Error while playing this track: ${data.exception?.message ?? 'unknown'}`);
    // Lavalink sends an "end" event with reason loadFailed right after this.
  });

  player.on('stuck', () => {
    playNext(guildId); // starting a new track replaces the stuck one
  });

  player.on('closed', data => {
    console.warn('Voice websocket closed:', data.code, data.reason);
    destroyState(guildId);
  });

  player.on('start', () => console.log('Lavalink: track started'));
  player.on('end', data => console.log('Lavalink: track ended, reason =', data.reason));
  player.on('update', data => console.log('player update:', JSON.stringify(data.state)));
}

// ---------------------------------------------------------------------------
// Slash commands
// ---------------------------------------------------------------------------
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
    .setDescription('Play a song from YouTube, Spotify or URL')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Name or URL of the song to play')
        .setRequired(true)
    ),  
  new SlashCommandBuilder()
    .setName('clearqueue')
    .setDescription('Svuota la coda musicale'),
  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Salta la canzone attuale')
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

client.once(Events.ClientReady, () => {
  console.log('Client ready');
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

      const node = shoukaku.getIdealNode();
      if (!node) {
        return await interaction.editReply('❌ Lavalink node is not connected (it may be waking up, try again in a minute).');
      }

      // URLs (YouTube, Spotify, ...) go as they are, plain text is searched on YouTube
      const identifier = /^https?:\/\//i.test(query) ? query : `ytsearch:${query}`;
      const result = await node.rest.resolve(identifier);

      if (!result || result.loadType === 'empty') {
        return await interaction.editReply(`❌ No results found for \`${query}\`.`);
      }

      if (result.loadType === 'error') {
        console.error('Load failed:', result.data);
        return await interaction.editReply('❌ Failed to load the track.');
      }

      let tracks;
      let message;
      if (result.loadType === 'playlist') {
        tracks = result.data.tracks;
        message = `✅ Playlist **${result.data.info.name}** added with ${tracks.length} tracks.`;
      } else if (result.loadType === 'search') {
        tracks = [result.data[0]];
        message = `✅ Track **${tracks[0].info.title}** added to queue.`;
      } else {
        // 'track'
        tracks = [result.data];
        message = `✅ Track **${tracks[0].info.title}** added to queue.`;
      }

      const guildId = interaction.guild.id;
      let state = guildStates.get(guildId);
      if (!state) {
        const player = await shoukaku.joinVoiceChannel({
          guildId,
          channelId: voiceChannel.id,
          shardId: interaction.guild.shardId,
          deaf: true
        });
        state = { player, queue: [], playing: false, textChannelId: interaction.channel.id };
        guildStates.set(guildId, state);
        attachPlayerEvents(guildId, state);
      }

      state.queue.push(...tracks);
      await interaction.editReply(message);

      if (!state.playing) playNext(guildId);

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
  else if (commandName === 'clearqueue') {
    const state = guildStates.get(interaction.guild.id);

    if (!state || state.queue.length === 0) {
      return interaction.reply({ content: 'La coda è già vuota.', ephemeral: true });
    }

    const count = state.queue.length;
    state.queue.length = 0;
    await interaction.reply(`🗑️ Ho rimosso ${count} brani dalla coda.`);
  }
  else if (commandName === 'skip') {
    const state = guildStates.get(interaction.guild.id);

    if (!state || !state.playing) {
      return interaction.reply({ content: 'Non sta suonando niente.', ephemeral: true });
    }

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: 'Devi essere in un canale vocale.', ephemeral: true });
    }

    await interaction.reply('⏭️ Canzone saltata.');
    playNext(interaction.guild.id);
  }
});

client.login(TOKEN);