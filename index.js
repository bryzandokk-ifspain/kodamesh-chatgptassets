require('dotenv').config();

const {
    Client,
    Collection,
    GatewayIntentBits,
    REST,
    Routes,
    EmbedBuilder
} = require('discord.js');

const fs = require('fs');
const path = require('path');


// ============================================================
// CLIENT
// ============================================================

const client =
    new Client({

        intents: [

            GatewayIntentBits.Guilds,

            GatewayIntentBits.GuildMessages

        ]

    });


client.commands =
    new Collection();


// ============================================================
// CARGAR COMANDOS
// ============================================================

const commandsPath =
    path.join(
        __dirname,
        'commands'
    );

let commandFiles = [];

try {

    commandFiles =
        fs.readdirSync(
            commandsPath
        )
            .filter(
                file =>
                    file.endsWith('.js')
            );

} catch (error) {

    console.error(
        '[FATAL] Could not read the commands folder:',
        error
    );

    process.exit(1);
}


for (
    const file of commandFiles
) {

    const filePath =
        path.join(
            commandsPath,
            file
        );

    try {

        delete require.cache[
            require.resolve(
                filePath
            )
        ];

        const command =
            require(
                filePath
            );

        if (
            command &&
            command.data &&
            typeof command.execute ===
                'function'
        ) {

            const commandName =
                command.data.name;

            if (
                client.commands.has(
                    commandName
                )
            ) {

                console.warn(
                    `[COMMAND]  Duplicate command skipped: /${commandName}`
                );

                continue;
            }

            client.commands.set(
                commandName,
                command
            );

            console.log(
                `[COMMAND] Loaded: /${commandName}`
            );

        } else {

            console.warn(
                `[COMMAND]  ${file} does not have valid data/execute properties.`
            );
        }

    } catch (error) {

        console.error(
            `[ERROR] Could not load ${file}:`,
            error
        );
    }
}


// ============================================================
// REGISTRAR SLASH COMMANDS
// ============================================================

if (!process.env.TOKEN) {
    console.error('[FATAL] TOKEN is missing from .env');
    process.exit(1);
}

if (!process.env.CLIENT_ID) {
    console.error('[FATAL] CLIENT_ID is missing from .env');
    process.exit(1);
}

const rest =
    new REST()
        .setToken(process.env.TOKEN);


(async () => {

    try {

        console.log('');

        console.log(
            '============================================'
        );

        console.log(
            ' REGISTERING SLASH COMMANDS'
        );

        console.log(
            '============================================'
        );


        const commands = [];

        const names =
            new Set();


        for (
            const file of commandFiles
        ) {

            try {

                const filePath =
                    path.join(
                        commandsPath,
                        file
                    );

                delete require.cache[
                    require.resolve(
                        filePath
                    )
                ];

                const command =
                    require(
                        filePath
                    );


                if (
                    !command ||
                    !command.data ||
                    typeof command.data.toJSON !==
                        'function'
                ) {

                    continue;
                }


                const commandData =
                    command.data.toJSON();


                if (
                    names.has(
                        commandData.name
                    )
                ) {

                    console.warn(
                        `[COMMAND]  Duplicate command skipped: /${commandData.name}`
                    );

                    continue;
                }


                names.add(
                    commandData.name
                );


                commands.push(
                    commandData
                );


                console.log(
                    `[COMMAND] Ready: /${commandData.name}`
                );


            } catch (error) {

                console.error(
                    `[ERROR] Could not prepare ${file}:`,
                    error
                );

            }

        }


        console.log('');

        console.log(
            ` Total commands: ${commands.length}`
        );

        console.log('');


        // Los comandos globales son necesarios para que la aplicación
        // también pueda ofrecer comandos al instalarse como User Install.
        // Discord exige que integration_types y contexts estén en cada
        // payload de comando global.
        if (!process.env.CLIENT_ID) {
            throw new Error('CLIENT_ID is missing from .env.');
        }

        const globalCommands = commands.map(command => ({
            ...command,
            // 0 = GUILD_INSTALL, 1 = USER_INSTALL
            integration_types: [0, 1],
            // 0 = GUILD. Mantenemos los comandos en servidores para
            // evitar ofrecer comandos que dependen de canales/servidores
            // en DMs donde algunas funciones no están diseñadas para operar.
            contexts: [0]
        }));

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            {
                body: globalCommands
            }
        );

        // Elimina el registro antiguo limitado a un servidor. Así evitamos
        // que las versiones Guild oculten/entren en conflicto con las globales.
        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(
                    process.env.CLIENT_ID,
                    process.env.GUILD_ID
                ),
                {
                    body: []
                }
            );

            console.log(
                `[COMMAND] Removed the old server command registration for ${process.env.GUILD_ID}.`
            );
        }


        console.log(
            '============================================'
        );

        console.log(
            ' SLASH COMMANDS REGISTERED'
        );

        console.log(
            '============================================'
        );

        console.log('');


    } catch (error) {

        console.error(
            '[ERROR] Registering slash commands:',
            error
        );

    }

})();


// ============================================================
// READY
// ============================================================

client.once(
    'ready',
    () => {

        // ========================================================
        // STATUS DEL BOT
        // ========================================================

        client.user.setPresence({

            activities: [

                {
                    name: '@KodaMesh',
                    type: 0
                }

            ],

            status: 'online'

        });


        console.log('');

        console.log(
            '============================================'
        );

        console.log(
            ` Bot online as ${client.user.tag}`
        );

        console.log(
            ` Server: ${process.env.GUILD_ID}`
        );

        console.log(
            ` Commands loaded: ${client.commands.size}`
        );

        console.log(
            '============================================'
        );

        console.log('');

    }
);


// ============================================================
// INTERACTIONS
// ============================================================

client.on(
    'interactionCreate',
    async interaction => {


        // ====================================================
        // SLASH COMMANDS
        // ====================================================

        if (
            interaction.isChatInputCommand()
        ) {

            const commandName =
                interaction.commandName;


            const command =
                client.commands.get(
                    commandName
                );


            if (!command) {

                console.warn(
                    `[COMMAND] Could not find /${commandName}`
                );

                return;
            }


            // =================================================
            // PORTPACK
            // =================================================
            //
            // IMPORTANTE:
            //
            // /portpack tiene:
            //
            // /portpack pack
            // /portpack url
            //
            // El subcomando "url" necesita abrir un modal.
            //
            // Por eso NO hacemos deferReply() aquí.
            //
            // portpack.js controla su propia respuesta:
            //
            // pack -> deferReply()
            // url  -> showModal()
            //
            // =================================================

            if (
                commandName ===
                'portpack'
            ) {

                console.log('');

                console.log(
                    '============================================================'
                );

                console.log(
                    '[DISCORD] /portpack recibido.'
                );

                console.log(
                    `[DISCORD] Interaction ID: ${interaction.id}`
                );

                console.log(
                    '============================================================'
                );


                try {

                    await command.execute(
                        interaction
                    );


                } catch (error) {

                    console.error(
                        '[ERROR] Command /portpack:',
                        error
                    );


                    await safeInteractionError(
                        interaction,
                        error
                    );

                }


                return;
            }


            // =================================================
            // COMANDOS LARGOS
            // =================================================

            const longRunningCommands = [

                'imagetomesh3id',

                'idsound'

            ];


            if (
                longRunningCommands.includes(
                    commandName
                )
            ) {

                console.log('');

                console.log(
                    '============================================================'
                );

                console.log(
                    `[DISCORD] /${commandName} recibido.`
                );

                console.log(
                    `[DISCORD] Interaction ID: ${interaction.id}`
                );

                console.log(
                    '============================================================'
                );


                try {

                    await interaction.deferReply();


                    console.log(
                        `[DISCORD] /${commandName} ACK sent successfully.`
                    );


                } catch (error) {

                    console.error(
                        `[DISCORD]  Could not defer reply() - /${commandName}:`,
                        error
                    );

                    return;
                }


                try {

                    await command.execute(
                        interaction
                    );


                } catch (error) {

                    console.error(
                        `[ERROR] Command /${commandName}:`,
                        error
                    );


                    await safeInteractionError(
                        interaction,
                        error
                    );

                }


                return;
            }


            // =================================================
            // RESTO DE COMANDOS
            // =================================================

            try {

                await command.execute(
                    interaction
                );


            } catch (error) {

                console.error(
                    `[ERROR] Command /${commandName}:`,
                    error
                );


                await safeInteractionError(
                    interaction,
                    error
                );

            }


            return;
        }



        // ====================================================
        // BOTONES /aichat
        // ====================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith('aichat_')
        ) {

            const command =
                client.commands.get('aichat');

            if (
                !command ||
                typeof command.handleButton !== 'function'
            ) {
                console.error(
                    '[ERROR] /aichat has no handleButton.'
                );

                return;
            }

            try {

                await command.handleButton(
                    interaction
                );

            } catch (error) {

                console.error(
                    '[ERROR] /aichat button:',
                    error
                );

                await safeInteractionError(
                    interaction,
                    error
                );
            }

            return;
        }



        // ====================================================
        // MODAL /aichat
        // ====================================================

        if (
            interaction.isModalSubmit() &&
            interaction.customId.startsWith('aichat_modal_')
        ) {

            const command =
                client.commands.get('aichat');

            if (
                !command ||
                typeof command.handleModal !== 'function'
            ) {
                console.error(
                    '[ERROR] /aichat has no handleModal.'
                );

                return;
            }

            try {

                await command.handleModal(
                    interaction
                );

            } catch (error) {

                console.error(
                    '[ERROR] /aichat modal:',
                    error
                );

                await safeInteractionError(
                    interaction,
                    error
                );
            }

            return;
        }



        // ====================================================
        // MODAL /rblxavatarzip
        // ====================================================

        if (

            interaction.isModalSubmit() &&

            interaction.customId ===
                'rblxavatarzip_modal'

        ) {

            const command =
                client.commands.get(
                    'rblxavatarzip'
                );


            if (
                !command ||
                typeof command.handleModal !==
                    'function'
            ) {

                console.error(
                    '[ERROR] /rblxavatarzip has no handleModal'
                );

                return;
            }


            try {

                await command.handleModal(
                    interaction
                );


            } catch (error) {

                console.error(
                    '[ERROR] /rblxavatarzip modal:',
                    error
                );


                await safeInteractionError(
                    interaction,
                    error
                );

            }


            return;
        }


        // ====================================================
        // MODAL /previewpack
        // ====================================================

        if (

            interaction.isModalSubmit() &&

            interaction.customId ===
                'previewpack_modal'

        ) {

            const command =
                client.commands.get(
                    'previewpack'
                );


            if (
                !command ||
                typeof command.handleModal !==
                    'function'
            ) {

                console.error(
                    '[ERROR] /previewpack has no handleModal'
                );

                return;
            }


            try {

                await command.handleModal(
                    interaction
                );


            } catch (error) {

                console.error(
                    '[ERROR] /previewpack modal:',
                    error
                );


                await safeInteractionError(
                    interaction,
                    error
                );

            }


            return;
        }


        // ====================================================
        // MODAL /portpack URL
        // ====================================================

        if (

            interaction.isModalSubmit() &&

            interaction.customId ===
                'portpack_url_modal'

        ) {

            const command =
                client.commands.get(
                    'portpack'
                );


            if (
                !command ||
                typeof command.handleUrlModal !==
                    'function'
            ) {

                console.error(
                    '[ERROR] /portpack has no handleUrlModal.'
                );


                try {

                    if (
                        !interaction.replied &&
                        !interaction.deferred
                    ) {

                        await interaction.reply({

                            content:
                                ' El modo URL de /portpack is not configured correctly.',

                            ephemeral:
                                true

                        });

                    }

                } catch (error) {

                    console.error(
                        '[ERROR] Responding to modal:',
                        error.message
                    );

                }


                return;
            }


            try {

                await command.handleUrlModal(
                    interaction
                );


            } catch (error) {

                console.error(
                    '[ERROR] /portpack URL modal:',
                    error
                );


                await safeInteractionError(
                    interaction,
                    error
                );

            }


            return;
        }


        // ====================================================
        // MODAL /robloxavatar3d
        // ====================================================

        if (

            interaction.isModalSubmit() &&

            interaction.customId ===
                'roblox_avatar3d_modal'

        ) {

            try {

                await interaction.deferReply();


                const input =
                    interaction.fields
                        .getTextInputValue(
                            'roblox_user'
                        )
                        .trim();


                let userId;

                let username;


                // =================================================
                // ID
                // =================================================

                if (
                    /^\d+$/.test(
                        input
                    )
                ) {

                    userId =
                        input;


                    const userRes =
                        await fetch(
                            `https://users.roblox.com/v1/users/${userId}`
                        );


                    if (
                        !userRes.ok
                    ) {

                        throw new Error(
                            'User not found'
                        );

                    }


                    const userData =
                        await userRes.json();


                    username =
                        userData.name;


                } else {


                    // =================================================
                    // USERNAME
                    // =================================================

                    const res =
                        await fetch(
                            'https://users.roblox.com/v1/usernames/users',
                            {

                                method:
                                    'POST',

                                headers: {

                                    'Content-Type':
                                        'application/json'

                                },

                                body:
                                    JSON.stringify({

                                        usernames: [
                                            input
                                        ],

                                        excludeBannedUsers:
                                            false

                                    })

                            }
                        );


                    const data =
                        await res.json();


                    if (
                        !data.data ||
                        data.data.length === 0
                    ) {

                        throw new Error(
                            'User not found'
                        );

                    }


                    userId =
                        data.data[0].id;


                    username =
                        data.data[0].name;

                }


                // =================================================
                // AVATAR
                // =================================================

                const thumbRes =
                    await fetch(

                        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`

                    );


                const thumbData =
                    await thumbRes.json();


                if (

                    !thumbData.data?.[0] ||

                    thumbData.data[0].state !==
                        'Completed'

                ) {

                    throw new Error(
                        'Could not retrieve the avatar'
                    );

                }


                const avatarUrl =
                    thumbData.data[0].imageUrl;


                // =================================================
                // EMBED
                // =================================================

                const embed =
                    new EmbedBuilder()

                        .setColor(
                            0x00A2FF
                        )

                        .setTitle(
                            username
                        )

                        .setDescription(
                            `**ID:** \`${userId}\`\n\nYou can copy the ID directly.`
                        )

                        .setImage(
                            avatarUrl
                        )

                        .setFooter({

                            text:
                                'Roblox Avatar'

                        })

                        .setTimestamp();


                await interaction.editReply({

                    embeds: [
                        embed
                    ]

                });


            } catch (error) {

                console.error(
                    '[ERROR] /robloxavatar3d:',
                    error
                );


                await safeInteractionError(
                    interaction,
                    error
                );

            }


            return;
        }

    }
);


// ============================================================
// GLOBAL ERRORS
// ============================================================

client.on(
    'error',
    error => {

        console.error(
            '[DISCORD CLIENT ERROR]',
            error
        );

    }
);


process.on(
    'unhandledRejection',
    error => {

        console.error(
            '[UNHANDLED REJECTION]',
            error
        );

    }
);


process.on(
    'uncaughtException',
    error => {

        console.error(
            '[UNCAUGHT EXCEPTION]',
            error
        );

    }
);


// ============================================================
// SAFE ERROR
// ============================================================

async function safeInteractionError(
    interaction,
    error
) {

    const message =
        error?.message ||
        'An unexpected error occurred.';


    try {

        if (
            interaction.replied ||
            interaction.deferred
        ) {

            await interaction.editReply({

                content:
                    ` **Error:**\n\`${message.slice(
                        0,
                        1900
                    )}\``

            });


        } else {

            await interaction.reply({

                content:
                    ` **Error:**\n\`${message.slice(
                        0,
                        1900
                    )}\``,

                ephemeral:
                    true

            });

        }


    } catch (replyError) {

        console.error(
            '[DISCORD] Could not send the error:',
            replyError.message
        );

    }

}


// ============================================================
// LOGIN
// ============================================================

if (
    !process.env.TOKEN
) {

    console.error(
        '[FATAL] TOKEN is missing from .env'
    );

    process.exit(1);
}


client.login(
    process.env.TOKEN
);