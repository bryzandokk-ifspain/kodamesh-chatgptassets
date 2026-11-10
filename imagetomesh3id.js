const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const {
    exec
} = require('child_process');

const util = require('util');

const execPromise =
    util.promisify(exec);


// ============================================================
// CONFIGURATION
// ============================================================

const VALID_SIZES = [
    16,
    32,
    64,
    128,
    256,
    512
];


const FINAL_SIZE = 1024;


// ============================================================
// BLENDER
// ============================================================

const BLENDER_PATH =
    'C:\\Program Files\\Blender Foundation\\Blender 4.4\\blender.exe';


// ============================================================
// ROBLOX
// ============================================================

const UNIVERSE_ID =
    '10764746325';

const PLACE_ID =
    '113531224892646';


// ============================================================
// ROTATION
// ============================================================

const ROTATION_X = 90;

const ROTATION_Y = -45;

const ROTATION_Z = 0;


// ============================================================
// SOLIDIFY
// ============================================================

const SOLIDIFY_THICKNESS = 0.10;


// ============================================================
// COMANDO
// ============================================================

module.exports = {

    data:
        new SlashCommandBuilder()

            .setName(
                'imagetomesh3id'
            )

            .setDescription(
                'Convert a transparent Minecraft image into a 3D MeshPart'
            )

            .addAttachmentOption(
                option =>
                    option

                        .setName(
                            'image'
                        )

                        .setDescription(
                            'Transparent square image, 16x16 to 512x512'
                        )

                        .setRequired(
                            true
                        )
            )

            .addBooleanOption(
                option =>
                    option

                        .setName(
                            'goldapple'
                        )

                        .setDescription(
                            'Is this a golden apple?'
                        )

                        .setRequired(
                            true
                        )
            ),


    // ========================================================
    // EXECUTE
    // ========================================================

    async execute(
        interaction
    ) {

        console.log(
            '[IMAGETOMESH3ID] Starting command...'
        );


        // ====================================================
        // VALIDAR ACK
        // ====================================================

        if (
            !interaction.deferred &&
            !interaction.replied
        ) {

            throw new Error(
                'The interaction was not recognized by Discord before the command was executed'
            );

        }


        // ====================================================
        // DATA
        // ====================================================

        const attachment =
            interaction.options.getAttachment(
                'image'
            );


        const isGoldApple =
            interaction.options.getBoolean(
                'goldapple'
            );


        // ====================================================
        // VALID ATTACHMENT
        // ====================================================

        if (
            !attachment
        ) {

            await safeEditReply(
                interaction,
                'No image was provided'
            );

            return;

        }


        if (
            !attachment.contentType ||
            !attachment.contentType.startsWith(
                'image/'
            )
        ) {

            await safeEditReply(
                interaction,
                'The file must be an image'
            );

            return;

        }


        // ====================================================
        // TEMP
        // ====================================================

        const tempRoot =
            path.join(
                __dirname,
                '..',
                'temp'
            );


        if (
            !fs.existsSync(
                tempRoot
            )
        ) {

            fs.mkdirSync(
                tempRoot,
                {
                    recursive: true
                }
            );

        }


        const jobId =
            `imagetomesh_${Date.now()}`;


        const tempDir =
            path.join(
                tempRoot,
                jobId
            );


        fs.mkdirSync(
            tempDir,
            {
                recursive: true
            }
        );


        const originalPath =
            path.join(
                tempDir,
                'original.png'
            );


        const texturePath =
            path.join(
                tempDir,
                'texture_1024.png'
            );


        const fbxPath =
            path.join(
                tempDir,
                'minecraft_mesh.fbx'
            );


        const blendPath =
            path.join(
                tempDir,
                'minecraft_mesh.blend'
            );


        // ====================================================
        // EJECUTION
        // ====================================================

        try {

            // =================================================
            // DOWNLOAD
            // =================================================

            await safeEditReply(
                interaction,
                'Downloading image'
            );


            console.log(
                `[IMAGETOMESH3ID] Downloading ${attachment.url}`
            );


            const response =
                await axios.get(
                    attachment.url,
                    {
                        responseType:
                            'arraybuffer',

                        timeout:
                            30000,

                        maxContentLength:
                            25 * 1024 * 1024,

                        maxBodyLength:
                            25 * 1024 * 1024
                    }
                );


            fs.writeFileSync(
                originalPath,
                Buffer.from(
                    response.data
                )
            );


            // =================================================
            // METADATA
            // =================================================

            const metadata =
                await sharp(
                    originalPath
                ).metadata();


            const width =
                metadata.width;


            const height =
                metadata.height;


            console.log(
                `[IMAGETOMESH3ID] Input: ${width}x${height}`
            );


            // =================================================
            // VALID SQUARE
            // =================================================

            if (
                !width ||
                !height
            ) {

                throw new Error(
                    'The image resolution could not be detected'
                );

            }


            if (
                width !== height
            ) {

                await safeEditReply(

                    interaction,

                    `The image must be square\n\n` +
                    `Your image is **${width}x${height}**`

                );

                return;

            }


            // =================================================
            // VALID RESOLUTION
            // =================================================

            if (
                !VALID_SIZES.includes(
                    width
                )
            ) {

                await safeEditReply(

                    interaction,

                    `Invalid resolution\n\n` +

                    `Resoluciones permitidas:\n` +

                    `\`${VALID_SIZES
                        .map(
                            size =>
                                `${size}x${size}`
                        )
                        .join(', ')}\`\n\n` +

                    `Your image is **${width}x${height}**.`

                );

                return;

            }


            // =================================================
            // TEXTURA 1024
            // =================================================

            await safeEditReply(

                interaction,

                `preparing image\n\n` +

                `original: **${width}x${height}**\n` +

                `final texture: **${FINAL_SIZE}x${FINAL_SIZE}**\n\n` +

                `analyzing transparency`

            );


            await sharp(
                originalPath
            )

                .ensureAlpha()

                .resize(
                    FINAL_SIZE,
                    FINAL_SIZE,
                    {
                        kernel:
                            sharp.kernel.nearest
                    }
                )

                .png()

                .toFile(
                    texturePath
                );


            if (
                !fs.existsSync(
                    texturePath
                )
            ) {

                throw new Error(
                    'The 1024x1024 texture could not be created'
                );

            }


            // =================================================
            // BLENDER
            // =================================================

            await safeEditReply(

                interaction,

                `**Blender is creating the geometry**\n\n` +

                `Resolution: **${width}x${height}**\n` +

                `Texture: **${FINAL_SIZE}x${FINAL_SIZE}**\n\n` +

                `Applying Solidify\n` +

                `Preparing FBX`

            );


            await generateMeshWithBlender(

                texturePath,

                originalPath,

                fbxPath,

                blendPath,

                width,

                ROTATION_X,

                ROTATION_Y,

                ROTATION_Z

            );


            // =================================================
            // VERIFY FBX
            // =================================================

            if (
                !fs.existsSync(
                    fbxPath
                )
            ) {

                throw new Error(
                    'Blender finished, but it didnt create the FBX file'
                );

            }


            const fbxStats =
                fs.statSync(
                    fbxPath
                );


            if (
                fbxStats.size <= 0
            ) {

                throw new Error(
                    'The FBX file that was created is empty'
                );

            }


            console.log(
                `[IMAGETOMESH3ID] FBX created: ${fbxStats.size} bytes`
            );


            // =================================================
            // UPLOAD TEXTURE
            // =================================================

            await safeEditReply(

                interaction,

                'Uploading a 1024x1024 texture to roblox'

            );


            const textureId =
                await uploadAsset(

                    texturePath,

                    'Image',

                    `Texture_${Date.now()}`

                );


            console.log(
                `[IMAGETOMESH3ID] TextureId: ${textureId}`
            );


            // =================================================
            // UPLOAD MODEL
            // =================================================

            await safeEditReply(

                interaction,

                'Uploading 3D geometry to Roblox'

            );


            const modelId =
                await uploadAsset(

                    fbxPath,

                    'Model',

                    `MinecraftMesh_${Date.now()}`

                );


            console.log(
                `[IMAGETOMESH3ID] ModelId: ${modelId}`
            );


            // =================================================
            // EXTRACT MESHID
            // =================================================

            await safeEditReply(

                interaction,

                'Roblox is processing the MeshPart'

            );


            const meshId =
                await extractMeshIdWithLuau(
                    modelId
                );


            // =================================================
            // RESULT
            // =================================================

            const successEmbed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('✅ Mesh generated successfully')
                .setDescription(
                    `**MeshId / MeshContent**\n` +
                    `\`rbxassetid://${meshId}\`\n\n` +
                    `**TextureId**\n` +
                    `\`rbxassetid://${textureId}\``
                )
                .addFields(
                    {
                        name: 'Original image',
                        value: `${width}x${height}`,
                        inline: true
                    },
                    {
                        name: 'Solidify',
                        value: String(SOLIDIFY_THICKNESS),
                        inline: true
                    },
                    {
                        name: 'Gold apple',
                        value: isGoldApple ? 'Yes' : 'No',
                        inline: true
                    },
                    {
                        name: 'Rotation',
                        value: `X: ${ROTATION_X}°\nY: ${ROTATION_Y}°\nZ: ${ROTATION_Z}°`,
                        inline: false
                    }
                );

            await safeEditReply(
                interaction,
                { embeds: [successEmbed] }
            );


            console.log(
                '[IMAGETOMESH3ID] Completed successfully.'
            );


        } catch (error) {

            console.error(
                '[ERROR] /imagetomesh3id:',
                error
            );


            const errorEmbed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('ImageToMesh3ID failed')
                .setDescription(
                    `\`${String(
                        error?.message ||
                        'An unknown error occurred'
                    ).slice(0, 1800)}\``
                );

            await safeEditReply(
                interaction,
                { embeds: [errorEmbed] }
            );


        } finally {

            // =================================================
            // CLEANING
            // =================================================

            try {

                if (
                    fs.existsSync(
                        tempDir
                    )
                ) {

                    fs.rmSync(
                        tempDir,
                        {
                            recursive: true,
                            force: true
                        }
                    );


                    console.log(
                        `[CLEANUP] Deleted ${tempDir}`
                    );

                }

            } catch (cleanupError) {

                console.warn(
                    '[CLEANUP] Could not delete temp:',
                    cleanupError.message
                );

            }

        }

    }

};


// ============================================================
// BLENDER
// ============================================================

async function generateMeshWithBlender(

    texturePath,

    originalImagePath,

    fbxPath,

    blendPath,

    originalSize,

    rotationX,

    rotationY,

    rotationZ

) {

    const scriptPath =
        path.join(
            __dirname,
            '..',
            'create_image_mesh.py'
        );


    if (
        !fs.existsSync(
            scriptPath
        )
    ) {

        throw new Error(
            `create_image_mesh.py does not exist:\n${scriptPath}`
        );

    }


    if (
        !fs.existsSync(
            BLENDER_PATH
        )
    ) {

        throw new Error(
            `Blender was not found at:\n${BLENDER_PATH}`
        );

    }


    console.log(
        '[BLENDER] Starting...'
    );


    console.log(
        `[BLENDER] Texture: ${texturePath}`
    );


    console.log(
        `[BLENDER] Original: ${originalImagePath}`
    );


    console.log(
        `[BLENDER] FBX: ${fbxPath}`
    );


    // ========================================================
    // IMPORTANT
    // ========================================================
    //
    // --factory-startup
    //
    // prevents Blender from loading user add-onsss
    //
    // this eliminates issues such as:
    //
    // roblox Starter Rigs
    // tripo3D
    // third-party add-ons
    //
    // that were appearing in the console (CIE)
    // ========================================================


    const command =

        `"${BLENDER_PATH}" ` +

        `--factory-startup ` +

        `--background ` +

        `--python "${scriptPath}" ` +

        `-- ` +

        `"${texturePath}" ` +

        `"${originalImagePath}" ` +

        `"${fbxPath}" ` +

        `"${blendPath}" ` +

        `${originalSize} ` +

        `${rotationX} ` +

        `${rotationY} ` +

        `${rotationZ}`;


    console.log(
        '[BLENDER] Command prepared.'
    );


    let stdout = '';

    let stderr = '';


    try {

        const result =
            await execPromise(

                command,

                {

                    timeout:
                        180000,

                    maxBuffer:
                        50 * 1024 * 1024

                }

            );


        stdout =
            result.stdout ||
            '';

        stderr =
            result.stderr ||
            '';


    } catch (error) {

        stdout =
            error.stdout ||
            '';

        stderr =
            error.stderr ||
            '';


        console.error(
            '[BLENDER] Process error'
        );


        if (
            stdout
        ) {

            console.error(
                '[BLENDER STDOUT]',
                stdout
            );

        }


        if (
            stderr
        ) {

            console.error(
                '[BLENDER STDERR]',
                stderr
            );

        }


        throw new Error(

            `Blender crashed while generating the mesh\n\n` +

            `${error.message || 'Unknown error'}\n\n` +

            `Check the console for the Python error`

        );

    }


    if (
        stdout
    ) {

        console.log(
            '[BLENDER STDOUT]',
            stdout
        );

    }


    if (
        stderr
    ) {

        console.log(
            '[BLENDER STDERR]',
            stderr
        );

    }


    // ========================================================
    // DETECT REALS ERRORS
    // ========================================================

    const blenderOutput =
        `${stdout}\n${stderr}`;


    // we only consider it an error if our code
    // actually caused a Traceback or SyntaxError or idk
    //
    // messages from external add-ons are excluded
    // because we use --factory-startup


    if (
        /create_image_mesh\.py.*SyntaxError:/is.test(
            blenderOutput
        )
    ) {

        throw new Error(

            `create_image_mesh.py has an a error Python:\n\n` +

            blenderOutput.slice(
                -8000
            )

        );

    }


    if (
        /File ".*create_image_mesh\.py".*line/i.test(
            blenderOutput
        ) &&
        /Traceback \(most recent call last\):/i.test(
            blenderOutput
        )
    ) {

        throw new Error(

            `The Blender script produced an error:\n\n` +

            blenderOutput.slice(
                -8000
            )

        );

    }


    // ========================================================
    // FBX
    // ========================================================

    if (
        !fs.existsSync(
            fbxPath
        )
    ) {

        throw new Error(

            `Blender finished but did NOT create the FBX:\n` +

            `${fbxPath}`

        );

    }


    const stats =
        fs.statSync(
            fbxPath
        );


    if (
        stats.size <= 0
    ) {

        throw new Error(
            'El FBX fue creado pero está vacío.'
        );

    }


    console.log(
        `[BLENDER] FBX successfully created: ${stats.size} bytes`
    );


    if (
        fs.existsSync(
            blendPath
        )
    ) {

        console.log(
            `[BLENDER] Blend successfully created`
        );

    }

}


// ============================================================
// ROBLOX ASSET UPLOAD
// ============================================================

async function uploadAsset(

    filePath,

    assetType,

    name

) {

    const apiKey =
        process.env.ROBLOX_API_KEY;


    const creatorId =
        process.env.ROBLOX_CREATOR_ID;


    const isGroup =
        String(
            process.env.ROBLOX_IS_GROUP
        ).toLowerCase() === 'true';


    if (
        !apiKey ||
        !creatorId
    ) {

        throw new Error(
            'ROBLOX_API_KEY or ROBLOX_CREATOR_ID are missing from .env'
        );

    }


    if (
        !fs.existsSync(
            filePath
        )
    ) {

        throw new Error(
            `The file does not exist:\n${filePath}`
        );

    }


    const stats =
        fs.statSync(
            filePath
        );


    if (
        stats.size <= 0
    ) {

        throw new Error(
            `The file is empty:\n${filePath}`
        );

    }


    // ========================================================
    // FORM DATA
    // ========================================================

    const form =
        new FormData();


    const creator =
        isGroup

            ? {
                groupId:
                    String(
                        creatorId
                    )
            }

            : {
                userId:
                    String(
                        creatorId
                    )
            };


    const requestData = {

        assetType,

        displayName:
            name,

        description:
            'Automatically generated by RobloxImageBot',

        creationContext: {

            creator

        }

    };


    form.append(

        'request',

        JSON.stringify(
            requestData
        )

    );


    // ========================================================
    // CONTENT TYPE
    // ========================================================

    let contentType;


    if (
        assetType === 'Model'
    ) {

        contentType =
            'model/fbx';

    } else if (
        assetType === 'Image'
    ) {

        contentType =
            'image/png';

    } else {

        throw new Error(
            `AssetType unsupported: ${assetType}`
        );

    }


    form.append(

        'fileContent',

        fs.createReadStream(
            filePath
        ),

        {

            filename:
                path.basename(
                    filePath
                ),

            contentType

        }

    );


    // ========================================================
    // CREAR ASSET
    // ========================================================

    let createRes;


    try {

        createRes =
            await axios.post(

                'https://apis.roblox.com/assets/v1/assets',

                form,

                {

                    headers: {

                        ...form.getHeaders(),

                        'x-api-key':
                            apiKey

                    },

                    maxContentLength:
                        Infinity,

                    maxBodyLength:
                        Infinity,

                    timeout:
                        60000

                }

            );


    } catch (error) {

        const details =
            error.response?.data
                ? JSON.stringify(
                    error.response.data
                )
                : error.message;


        throw new Error(
            `Roblox rejected ${assetType}:\n${details}`
        );

    }


    const operationPath =
        createRes.data?.path;


    if (
        !operationPath
    ) {

        throw new Error(

            `Roblox did not return an operation path:\n` +

            JSON.stringify(
                createRes.data
            )

        );

    }


    const operationId =
        operationPath
            .split('/')
            .pop();


    console.log(
        `[ROBLOX] Operation: ${operationId}`
    );


    // ========================================================
    // POLLING
    // ========================================================

    let assetId = null;


    for (
        let i = 0;
        i < 40;
        i++
    ) {

        await sleep(
            1500
        );


        try {

            const statusRes =
                await axios.get(

                    `https://apis.roblox.com/assets/v1/operations/${operationId}`,

                    {

                        headers: {

                            'x-api-key':
                                apiKey

                        },

                        timeout:
                            15000

                    }

                );


            const data =
                statusRes.data;


            console.log(

                `[ROBLOX] ${assetType} ${name} ` +

                `check ${i + 1}/40: ${data.done}`

            );


            if (
                data.done === true
            ) {

                if (
                    data.error
                ) {

                    throw new Error(

                        data.error.message ||

                        JSON.stringify(
                            data.error
                        )

                    );

                }


                assetId =
                    data.response?.assetId;


                if (
                    !assetId
                ) {

                    throw new Error(

                        `Roblox finished but did not return the assetId:\n` +

                        JSON.stringify(
                            data
                        )

                    );

                }


                break;

            }


        } catch (error) {

            if (
                error.response
            ) {

                console.warn(

                    `[ROBLOX] Error checking operation ` +

                    `${i + 1}/40:`,

                    error.response.data ||
                    error.message

                );

            } else {

                throw error;

            }

        }

    }


    if (
        !assetId
    ) {

        throw new Error(
            `Timeout occurred while uploading ${name}.`
        );

    }


    console.log(
        `[ROBLOX] Asset created: ${assetId}`
    );


    // ========================================================
    // OPEN USE
    // ========================================================

    try {

        await axios.patch(

            'https://apis.roblox.com/asset-permissions-api/v1/assets/permissions',

            {

                subjectType:
                    'All',

                subjectId:
                    null,

                action:
                    'Use',

                requests: [

                    {

                        assetId:
                            Number(
                                assetId
                            )

                    }

                ]

            },

            {

                headers: {

                    'x-api-key':
                        apiKey,

                    'Content-Type':
                        'application/json'

                },

                timeout:
                    15000

            }

        );


        console.log(
            `[ROBLOX] Open Use applied: ${assetId}`
        );


    } catch (error) {

        console.warn(

            '[ROBLOX] Open Use could not be applied:',

            error.response?.data ||
            error.message

        );

    }


    return String(
        assetId
    );

}


// ============================================================
// LUAU → MESH ID
// ============================================================

async function extractMeshIdWithLuau(
    modelId
) {

    const apiKey =
        process.env.ROBLOX_API_KEY;


    if (
        !apiKey
    ) {

        throw new Error(
            'ROBLOX_API_KEY is missing'
        );

    }


    const luauScript = `

local InsertService = game:GetService("InsertService")

local success, result = pcall(function()

    local model = InsertService:LoadAsset(${modelId})

    if not model then
        error("InsertService did not return a Model")
    end

    local meshPart =
        model:FindFirstChildWhichIsA(
            "MeshPart",
            true
        )

    if not meshPart then
        error("No MeshPart found")
    end

    local meshId = meshPart.MeshId

    local id =
        string.match(
            tostring(meshId),
            "%d+"
        )

    if not id then
        error("Unable to extract the MeshId")
    end

    return id

end)

if success then
    return result
else
    error(tostring(result))
end

`;


    // ========================================================
    // CREAR TASK
    // ========================================================

    let createRes;


    try {

        createRes =
            await axios.post(

                `https://apis.roblox.com/cloud/v2/universes/${UNIVERSE_ID}/places/${PLACE_ID}/luau-execution-session-tasks`,

                {

                    script:
                        luauScript

                },

                {

                    headers: {

                        'x-api-key':
                            apiKey,

                        'Content-Type':
                            'application/json'

                    },

                    timeout:
                        30000

                }

            );


    } catch (error) {

        throw new Error(

            `Roblox rejected the Luau event:\n` +

            `${

                error.response?.data

                    ? JSON.stringify(
                        error.response.data
                    )

                    : error.message

            }`

        );

    }


    const taskPath =
        createRes.data?.path;


    if (
        !taskPath
    ) {

        throw new Error(
            'Roblox did not return the task path for Luau'
        );

    }


    console.log(
        `[LUAU] Task: ${taskPath}`
    );


    // ========================================================
    // POLLING
    // ========================================================

    let meshId = null;


    for (
        let i = 0;
        i < 30;
        i++
    ) {

        await sleep(
            2000
        );


        try {

            const statusRes =
                await axios.get(

                    `https://apis.roblox.com/cloud/v2/${taskPath}`,

                    {

                        headers: {

                            'x-api-key':
                                apiKey

                        },

                        timeout:
                            15000

                    }

                );


            const data =
                statusRes.data;


            const state =
                data?.state;


            console.log(
                `[LUAU] ${i + 1}/30: ${state}`
            );


            if (
                state === 'COMPLETE'
            ) {

                const results =
                    data
                        ?.output
                        ?.results;


                if (
                    results &&
                    results[0] !== undefined &&
                    results[0] !== null
                ) {

                    meshId =
                        String(
                            results[0]
                        );

                    break;

                }


                throw new Error(
                    'Luau finished but did not return MeshID'
                );

            }


            if (
                state === 'FAILED' ||
                state === 'CANCELLED'
            ) {

                throw new Error(

                    `Luau failed: ` +

                    `${data?.error?.message ||
                        'Unknown error'}`

                );

            }


        } catch (error) {

            if (
                error.response
            ) {

                console.warn(
                    `[LUAU] Error ${i + 1}/30:`,
                    error.response.data ||
                    error.message
                );

            } else {

                throw error;

            }

        }

    }


    if (
        !meshId
    ) {

        throw new Error(
            'Tiempo de espera agotado en Luau.'
        );

    }


    console.log(
        `[LUAU] MeshId extracted: ${meshId}`
    );


    // ========================================================
    // OPEN USE MESH
    // ========================================================

    try {

        await axios.patch(

            'https://apis.roblox.com/asset-permissions-api/v1/assets/permissions',

            {

                subjectType:
                    'All',

                subjectId:
                    null,

                action:
                    'Use',

                requests: [

                    {

                        assetId:
                            Number(
                                meshId
                            )

                    }

                ]

            },

            {

                headers: {

                    'x-api-key':
                        apiKey,

                    'Content-Type':
                        'application/json'

                },

                timeout:
                    15000

            }

        );


        console.log(
            `[ROBLOX] Open Use applied to MeshId ${meshId}`
        );


    } catch (error) {

        console.warn(

            '[ROBLOX] Open Use could not be applied to the MeshID:',

            error.response?.data ||
            error.message

        );

    }


    return meshId;

}


// ============================================================
// SAFE EDIT REPLY
// ============================================================

async function safeEditReply(
    interaction,
    content
) {

    try {

        if (
            !interaction.deferred &&
            !interaction.replied
        ) {

            console.warn(
                '[DISCORD] Unknown interaction'
            );

            return false;

        }


        await interaction.editReply(
            content
        );


        return true;


    } catch (error) {

        if (
            error?.code === 10062
        ) {

            console.error(
                '[DISCORD] Unknown interaction in editReply()'
            );

        } else {

            console.error(
                '[DISCORD] Error editReply():',
                error.message
            );

        }


        return false;

    }

}


// ============================================================
// SLEEP
// ============================================================

function sleep(
    ms
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}