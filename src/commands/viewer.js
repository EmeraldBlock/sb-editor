const { createCanvas } = require("canvas");
const { MessageAttachment } = require("discord.js");
const { viewerAccessRoles } = require("../../config.json");
const { handleInstruction } = require("../instruction_viewer");
const { toShortKey } = require("../viewer/shape");
const { renderShape } = require("../viewer/viewer");

/**
 * Extracts shape definitions and modifiers from messages.
 * @param {string} message
 */
function extractShapes(message) {
    const parts = message.split("{").slice(1);
    const shapes = [];
    if (parts.length == 0) {
        // No shapes can be found, return immediately
        return shapes;
    }

    for (const part of parts) {
        const endIndex = part.indexOf("}");
        if (endIndex == -1) {
            continue;
        }

        const instruction = part.slice(0, endIndex);
        const flags = instruction.split("+");
        const shortKey = flags.shift();

        if (flags.length > 10) {
            throw new Error("Limit of modifiers reached");
        }

        shapes.push(...handleInstruction(shortKey, flags));
    }

    return shapes;
}

/**
 * Renders all provided shapes to a canvas, and exports
 * it to a PNG buffer.
 * @param {string[]} shapes
 */
function renderShapes(shapes) {
    const shapeSize = 56;
    const columnsCount = Math.min(shapes.length, 8);
    const rowsCount = Math.ceil(shapes.length / columnsCount);

    const imageWidth = shapeSize * columnsCount;
    const imageHeight = shapeSize * rowsCount;

    const canvas = createCanvas(imageWidth, imageHeight);
    const ctx = canvas.getContext("2d");

    for (const index in shapes) {
        const shapeImage = renderShape(shapes[index], shapeSize);

        const x = (index % columnsCount) * shapeSize;
        const y = Math.floor(index / columnsCount) * shapeSize;
        ctx.drawImage(shapeImage, x, y);
    }

    const buffer = canvas.toBuffer("image/png");
    return buffer;
}

/**
 * @param {import("discord.js").Message} msg
 */
async function execute(msg) {
    if (msg.content.toLowerCase().startsWith("sbe:viewer")) {
        throw new Error("You are not supposed to directly call this command");
    }

    const callerRoles = msg.member.roles.cache;
    if (!callerRoles.some((role) => viewerAccessRoles.includes(role.id))) {
        // Ignore users who cannot use the viewer
        return;
    }

    const shapes = extractShapes(msg.content).slice(0, 64);
    if (shapes.length == 0) {
        return;
    }

    const image = renderShapes(shapes);
    await msg.channel.send({
        files: [new MessageAttachment(image, "shapes.png")]
    });
}

/**
 * Checks for messages possibly containing instructions.
 * @param {import("discord.js").Message} msg
 */
async function watcher(msg) {
    if (msg.author.bot) return;
    if (!msg.content.includes("{")) return;

    try {
        await execute(msg);
    } catch (err) {
        console.log(err);
        /* ignore errors in non-interactive mode */
    }
}

module.exports = {
    name: "sbe:viewer",
    execute,
    load: (client) => {
        client.on("messageCreate", watcher);
    },
    unload: (client) => {
        client.off("messageCreate", watcher);
    }
};