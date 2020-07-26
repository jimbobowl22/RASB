const TOKEN = "TOKEN HERE";
const DB_URI = "DB HERE";

const discord = require("discord.js");
const fetch = require("node-fetch");
const quickdb = require("quick.db");
const client = new discord.Client();
const mongodb = require("mongodb");
const express = require("express");
const messenger = require("messenger");
const app = express();
const db = new mongodb.MongoClient(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const listen = messenger.createListener(40101);

var pendingActions = new Map();

listen.on("UNBAN_USER", (m, data) => {
    let unbanned = [];
    let sc = 0;
    client.guilds.cache.array().forEach((guild) => {
        guild.fetchBans().then((bans) => {
            bans.array().forEach((user) => {
                if (user.id == data) {
                    guild.members.unban(user).then(() => {
                        sc++;
                        unbanned.push(guild.name);
                    }).catch(() => {});
                } else {
                    sc++;
                }
            });
        }).catch(() => {});
    });
    let interval = setInterval(() => {
        if (sc >= client.guilds.cache.size) {
            clearTimeout(interval);
            m.reply(unbanned);
        }
    }, 1000);
});

app.get("/api/bans", (req, res) => {
    const collection = db.db("rasb").collection("bans");
    collection.find({}).toArray().then((docs) => {
        res.status(200).send({ status: 200, message: "OK", data: docs });
    }).catch(() => {
        res.status(500).send({ status: 500, message: "DB_ERROR" });
    })
});

client.on("ready", () => {
    console.log("Blacklist | Connected to Discord");
    client.user.setActivity("for ?help", {
        type: "WATCHING"
    });
});

client.on("guildMemberAdd", (member) => {
    const collection = db.db("rasb").collection("bans");
    collection.findOne({ discordId: member.user.id }).then((doc) => {
        if (doc) {
            if (member.bannable) {
                member.ban().then(() => {
                    member.user.createDM().then((dm) => {
                        let embed = new discord.MessageEmbed()
                            .setTitle("Blacklisted")
                            .setDescription("You are in the RASB ban database. You can appeal here: INVITE HERE")
                            .setFooter("RASB Union");
                        dm.send(embed).catch(() => {});
                    }).catch(() => {});
                });
            }
        }
    }).catch(() => {});
});

client.on("messageReactionAdd", (reaction, user) => {
    if (pendingActions.has(user.id)) {
        let data = pendingActions.get(user.id);
        if (data.messageId == reaction.message.id) {
            pendingActions.delete(user.id);
            let embed = new discord.MessageEmbed()
                .setTitle("Working")
                .setDescription("Please wait")
                .setFooter("RASB Union");
            reaction.message.channel.send(embed).then((m) => {
                let ban = data.action == "BAN";
                let banOk = [];
                let banEr = [];
                data.guilds.forEach((guild) => {
                    if (ban) {
                        guild.members.ban(daa.user.id, { reason: "RASB Union - Blacklist" }).then(() => {
                            banOk.push(guild.name);
                        }).catch(() => {
                            banEr.splice(guild.name);
                        });
                    } else {
                        guild.member(data.user).kick("RASB Union - Blacklist").then(() => {
                            banOk.push(guild.name);
                        }).catch(() => {
                            banEr.splice(guild.name);
                        })
                    }
                });
                let embed = new discord.MessageEmbed()
                    .setTitle(ban ? "Banned" : "Kicked")
                    .setDescription(`Successfully ${ban ? "banned" : "kicked"} in ${banOk.length} of ${data.guilds.length} guilds`)
                    .addField("Completed", (banOk.length > 0 ? banOk.join("\n") : "N/A"))
                    .addField("Failed", (banEr.length > 0 ? banEr.join("\n") : "N/A"))
                    .setFooter("RASB Union");
                reaction.message.channel.send(embed);
            });
        }
    } else if (quickdb.has(reaction.message.id)) {
        let guild = client.guilds.cache.get("699950979147235369");
        let member = guild.member(user);
        if (member) {
            if (member.roles.cache.has("700034484019527764") || member.roles.cache.has("700034882755100745") || member.roles.cache.has("700034374959366236") || user.id == "286568194548957203") {
                let data = quickdb.get(reaction.message.id);
                let accused = client.users.cache.has(data.accused) ? client.users.cache.get(data.accused) : null;
                let reporter = client.users.cache.has(data.reporter) ? client.users.cache.get(data.reporter) : null;
                if (accused == null || reporter == null) {
                    let embed = new discord.MessageEmbed()
                        .setTitle("Error")
                        .setDescription("Unable to find the accused user or reporter")
                        .setFooter("RASB Union");
                    reaction.message.channel.send(embed);
                    return;
                }
                let evidence = data.evidence;
                if (accused.id != user.id && reporter.id != user.id && user.id != client.user.id) {
                    if (reaction.emoji.toString() == "✅") {
                        reporter.createDM().then((dm) => {
                            let embed = new discord.MessageEmbed()
                                .setTitle("Accepted")
                                .setDescription(`Your report about <@${accused.id}> was accepted`)
                                .setFooter("RASB Union");
                            dm.send(embed).catch(() => {});
                        }).catch(() => {});
                        let guild = client.guilds.cache.get("699950979147235369");
                        let channel = guild.channels.cache.get("700260792372559872");
                        let embed = new discord.MessageEmbed()
                            .setTitle("Report Accepted")
                            .setDescription(`Accepted by <@${user.id}>`)
                            .addField("Submitter", `<@${reporter.id}>`, false)
                            .addField("Accused", `<@${accused.id}>`, false)
                            .addField("Evidence", evidence)
                            .setFooter("RASB Union");
                        channel.send(embed).then(() => {
                            const collection = db.db("rasb").collection("bans");
                            collection.insertOne({ discordId: accused.id }).then(() => {
                                let servers = [];
                                client.guilds.cache.forEach((guild) => {
                                    if (guild.member(accused)) {
                                        servers.push(guild);
                                    }
                                });
                                servers.forEach((guild) => {
                                    guild.members.ban(accused.id, { reason: "RASB Union - Blacklist" }).catch(() => {});
                                });
                            }).catch(() => {
                                let embed = new discord.MessageEmbed()
                                    .setTitle("Error")
                                    .setDescription(`Unable to add <@${accused.id}> to ban database`)
                                    .setFooter("RASB Union");
                                reaction.message.channel.send(embed);
                            });
                        });
                        quickdb.delete(reaction.message.id);
                    } else if (reaction.emoji.toString() == "❌") {
                        let embed = new discord.MessageEmbed()
                            .setTitle("Declined")
                            .setDescription(`Your report about <@${accused.id}> was declined`)
                            .setFooter("RASB Union");
                        reporter.send(embed).catch(() => {});
                        let guild = client.guilds.cache.get("699950979147235369");
                        let channel = guild.channels.cache.get("700656213167439922");
                        let embed = new discord.MessageEmbed()
                            .setTitle("Report Declined")
                            .setDescription(`Declined by <@${user.id}>`)
                            .addField("Submitter", `<@${reporter.id}>`, false)
                            .addField("Accused", `<@${accused.id}>`, false)
                            .addField("Evidence", evidence)
                            .setFooter("RASB Union");
                        channel.send(embed);
                        quickdb.delete(reaction.message.id);
                    }
                }
            }
        }
    }
});

client.on("message", (message) => {
    if (message.content.startsWith("?")) {
        const args = message.content.slice(1).split(/ +/).slice(1);
        if (message.content == "?help") {
            let embed = new discord.MessageEmbed()
                .setDescription("Commands")
                .addField("?help", "Displays the help dialog")
                .addField("?info", "Bot information")
                .addField("?lookup <@user>", "Lookup a user to see what servers they're in")
                .addField("?report <@user> <evidence>", "Reports a user to RASB Union")
                .addField("?gkick <@user>", "Kicks user from all RASB servers *(MOD+)*")
                .addField("?gban <@user>", "Bans user from all RASB servers *(MOD+)*")
                .addField("?fban <user id>", "Adds user to ban database *(MOD+)*")
                .addField("?dm <@user> <message>", "DMs a user *(STAFF+)*")
                .addField("?dmowners <message>", "DMs all server owners")
                .addField("?eval <code>", "Evaluates JavaScript code *(BOT DEVELOPER)*")
                .setFooter("RASB Union");
            message.channel.send(embed);
        } else if (message.content.startsWith("?gban") && (message.member.roles.cache.has("700034484019527764") || message.member.roles.cache.has("700034882755100745") || message.author.id == "286568194548957203")) {
            /**
             * @param {discord.User} user 
             */
            var handle = (user) => {
                let notifembed = new discord.MessageEmbed()
                    .setTitle("Notification")
                    .setDescription("You have been added to the RASB Union blacklist database. You can appeal here: INVITE HERE")
                    .setFooter("RASB Union");
                user.createDM().then((dm) => {
                    dm.send(notifembed).catch(() => {
                        let embed = new discord.MessageEmbed()
                            .setTitle("Warning")
                            .setDescription("Unable to notify user")
                            .setFooter("RASB Union");
                        message.channel.send(embed);
                    });
                }).catch(() => {
                    let embed = new discord.MessageEmbed()
                        .setTitle("Warning")
                        .setDescription("Unable to notify user")
                        .setFooter("RASB Union");
                    message.channel.send(embed);
                });
                let embed = new discord.MessageEmbed()
                    .setTitle("Working")
                    .setDescription("Adding user to ban database")
                    .setFooter("RASB Union");
                message.channel.send(embed).then((m) => {
                    const collection = db.db("rasb").collection("bans");
                    collection.insertOne({ discordId: user.id }).then(() => {
                        let embed = new discord.MessageEmbed()
                            .setTitle("Working")
                            .setDescription("Checking for user")
                            .setFooter("RASB Union");
                        m.edit(embed).then(() => {
                            let guild = client.guilds.cache.get("699950979147235369");
                            let channel = guild.channels.cache.get("700260792372559872");
                            if (channel) {
                                let embed = new discord.MessageEmbed()
                                    .setTitle("Blacklisted")
                                    .setAuthor(user.username, user.avatarURL())
                                    .addField("User Id", user.id, true)
                                    .addField("User Tag", `${user.username}#${user.discriminator}`, true)
                                    .setFooter("RASB Union")
                                channel.send(embed);
                            }
                            let servers = [];
                            let serverNames = [];
                            client.guilds.cache.forEach((guild) => {
                                if (guild.member(user)) {
                                    servers.push(guild);
                                    serverNames.push(guild.name);
                                }
                            });
                            let embed = new discord.MessageEmbed()
                                .setTitle("Found user")
                                .setDescription(`Found in ${servers.length}/${client.guilds.cache.size}`)
                                .addField("Servers", serverNames.join("\n"))
                                .setFooter("RASB Union");
                            m.edit(embed);
                            let embed2 = new discord.MessageEmbed()
                                .setTitle("Comfirmation")
                                .setDescription("React with :white_check_mark: to ban from the listed servers")
                                .addField("Servers", serverNames.join("\n"))
                                .setFooter("RASB Union");
                            message.channel.send(embed2).then((msg) => {
                                pendingActions.set(message.author.id, {
                                    user: user,
                                    guilds: servers,
                                    messageId: msg.id,
                                    action: "BAN"
                                });
                                msg.react("✅").catch(() => {});
                            });
                        });
                    }).catch(() => {
                        let embed = new discord.MessageEmbed()
                            .setTitle("Error")
                            .setDescription("Unable to add user to database")
                            .setFooter("RASB Union");
                        m.edit(embed);
                    });
                });
            };
            if (message.mentions.users.size > 0) {
                handle(message.mentions.users.first())
            } else if (message.mentions.members.size > 0) {
                handle(message.mentions.members.first());
            } else {
                if (client.users.cache.has(args[0])) {
                    handle(client.users.cache.get(args[0]));
                } else {
                    let embed = new discord.MessageEmbed()
                        .setTitle("Error")
                        .setDescription("Please mention a user")
                        .setFooter("RASB Union");
                    message.channel.send(embed);
                }
            }
        } else if (message.content.startsWith("?unban") && (message.member.roles.cache.has("700034374959366236") || message.member.roles.cache.has("700034484019527764") || message.member.roles.cache.has("700034882755100745") || message.author.id == "286568194548957203")) {
            if (args.length > 0) {
                let id = args[0];
                const collection = db.db("rasb").collection("bans");
                collection.deleteOne({ discordId: id }).then(() => {
                    message.channel.send("Removed from DB");
                    client.guilds.cache.array().forEach((g) => {
                        g.fetchBans().then((bans) => {
                            bans.forEach((ban) => {
                                if (ban.user.id == id) {
                                    g.members.unban(id).then(() => {
                                        message.channel.send(`Unbanned from ${g.name}`);
                                    }).catch(() => {
                                        message.channel.send(`Unabne to unban from ${g.name} MISSING PERMISSIONS`);
                                    });
                                }
                            });
                        });
                    });
                }).catch(() => {
                    let embed = new discord.MessageEmbed()
                        .setTitle("Error")
                        .setDescription("Database error")
                        .setFooter("RASB Union");
                    message.channel.send(embed);
                });
            } else {
                let embed = new discord.MessageEmbed()
                    .setTitle("Error")
                    .setDescription("Please specify a user **id**")
                    .setFooter("RASB Union");
                message.channel.send(embed);
            }
        } else if (message.content.startsWith("?fban") && (message.member.roles.cache.has("700034484019527764") || message.member.roles.cache.has("700034882755100745") || message.author.id == "286568194548957203")) {
            if (args.length > 0) {
                let id = args[0];
                const collection = db.db("rasb").collection("bans");
                collection.insertOne({ discordId: id }).then(() => {
                    let embed = new discord.MessageEmbed()
                        .setTitle("Banned")
                        .setDescription("Completed")
                        .setFooter("RASB Union");
                    message.channel.send(embed);
                }).catch(() => {
                    let embed = new discord.MessageEmbed()
                        .setTitle("Error")
                        .setDescription("Unable to add user to database")
                        .setFooter("RASB Union");
                    message.channel.send(embed);
                });
            } else {
                let embed = new discord.MessageEmbed()
                    .setTitle("Error")
                    .setDescription("Please specify a user **id**")
                    .setFooter("RASB Union");
                message.channel.send(embed);
            }
        } else if (message.content.startsWith("?gkick") && (message.member.roles.cache.has("700034484019527764") || message.member.roles.cache.has("700034882755100745") || message.author.id == "286568194548957203")) {
            /**
             * @param {discord.User} user 
             */
            let handle = (user) => {
                let servers = [];
                let serverNames = [];
                client.guilds.cache.forEach((guild) => {
                    if (guild.member(user)) {
                        servers.push(guild);
                        serverNames.push(guild.name);
                    }
                });
                let embed = new discord.MessageEmbed()
                    .setTitle("Found user")
                    .setDescription(`Found in ${servers.length}/${client.guilds.cache.size}`)
                    .addField("Servers", serverNames.join("\n"))
                    .setFooter("RASB Union");
                message.channel.send(embed);
                let embed2 = new discord.MessageEmbed()
                    .setTitle("Comfirmation")
                    .setDescription("React with :white_check_mark: to kick from the listed servers")
                    .addField("Servers", serverNames.join("\n"))
                    .setFooter("RASB Union");
                message.channel.send(embed2).then((msg) => {
                    pendingActions.set(message.author.id, {
                        user: user,
                        guilds: servers,
                        messageId: msg.id,
                        action: "KICK"
                    });
                    msg.react("✅").catch(() => {});
                });
            };
            if (message.mentions.users.size > 0) {
                handle(message.mentions.users.first())
            } else if (message.mentions.members.size > 0) {
                handle(message.mentions.members.first());
            } else {
                if (client.users.cache.has(args[0])) {
                    handle(client.users.cache.get(args[0]));
                } else {
                    let embed = new discord.MessageEmbed()
                        .setTitle("Error")
                        .setDescription("Please mention a user")
                        .setFooter("RASB Union");
                    message.channel.send(embed);
                }
            }
        } else if (message.content.startsWith("?report")) {
            if (true || message.member.hasPermission("BAN_MEMBERS") || message.author.id == "286568194548957203" || message.author.id == "684516973853278266") {
                /**
                 * @param {discord.User} user 
                 */
                let handle = (user) => {
                    let content = message.content;
                    if (message.deletable) {
                        message.delete();
                    } else {
                        let embed = new discord.MessageEmbed()
                            .setTitle("Warning")
                            .setDescription("Message not deleteable")
                            .setFooter("RASB Union");
                        message.channel.send(embed);
                    }
                    let embed = new discord.MessageEmbed()
                        .setTitle("Working")
                        .setDescription("Please wait")
                        .setFooter("RASB Union");
                    message.channel.send(embed).then((m) => {
                        let guild = client.guilds.cache.get("699950979147235369");
                        let channel = guild.channels.cache.get("700043367228112977");
                        let images = [];
                        message.attachments.array().forEach((att) => {
                            images.push(att.url);
                        });
                        let embed = new discord.MessageEmbed()
                            .setTitle("Report")
                            .setDescription(`Report about user <@${user.id}>`)
                            .addField("Submitter", `<@${message.author.id}>`, true)
                            .addField("Submitter Id", message.author.id, true)
                            .addField("Submitter Tag", `${message.author.username}#${message.author.discriminator}`, true)
                            .addField("Evidence", args.slice(1).join(" ") + (images.length > 0 ? " " + images.join(" ") : ""), false)
                            .addField("Accused", `<@${user.id}>`, true)
                            .addField("Accused Id", user.id, true)
                            .addField("Accused Tag", `${user.username}#${user.discriminator}`, true)
                            .addField("Reported In", message.guild.name, false)
                            .setFooter("RASB Union");
                        channel.send(embed).then((msg) => {
                            msg.react("✅").then(() => {
                                msg.react("❌").then(() => {
                                    quickdb.set(msg.id, {
                                        accused: user.id,
                                        reporter: message.author.id,
                                        evidence: args.slice(1).join(" ")
                                    });
                                    let embed = new discord.MessageEmbed()
                                        .setTitle("Sent")
                                        .setDescription("Report sent")
                                        .setFooter("RASB Union");
                                    m.edit(embed);
                                }).catch(() => {
                                    let embed = new discord.MessageEmbed()
                                        .setTitle("Error")
                                        .setDescription("An error occured sending the report")
                                        .setFooter("RASB Union");
                                    m.edit(embed);
                                });
                            }).catch(() => {
                                let embed = new discord.MessageEmbed()
                                    .setTitle("Error")
                                    .setDescription("An error occured sending the report")
                                    .setFooter("RASB Union");
                                m.edit(embed);
                            });
                        });
                    });
                };
                if (message.mentions.users.size > 0) {
                    handle(message.mentions.users.first())
                } else if (message.mentions.members.size > 0) {
                    handle(message.mentions.members.first().user);
                } else {
                    if (client.users.cache.has(args[0])) {
                        handle(client.users.cache.get(args[0]));
                    } else {
                        let embed = new discord.MessageEmbed()
                            .setTitle("Error")
                            .setDescription("Please mention a user")
                            .setFooter("RASB Union");
                        message.channel.send(embed);
                    }
                }
            } else {
                let embed = new discord.MessageEmbed()
                    .setTitle("Error")
                    .setDescription("You require ban permissions to report a user")
                    .setFooter("RASB Union");
                message.channel.send(embed);
            }
        } else if (message.content == "?info") {
            let embed = new discord.MessageEmbed()
                .setDescription("Information")
                .addField("Server Count", client.guilds.cache.size)
                .addField("Prefix", "?")
                .setFooter("RASB Union");
            message.channel.send(embed);
        } else if (message.content.startsWith("?lookup")) {
            /**
             * @param {discord.User} user 
             */
            let handle = (user) => {
                if (user.bot) return;
                let embed = new discord.MessageEmbed()
                    .setTitle("Working")
                    .setDescription("Please wait")
                    .setFooter("RASB Union");
                message.channel.send(embed).then((m) => {
                    let servers = [];
                    client.guilds.cache.forEach((guild) => {
                        if (guild.member(user)) {
                            servers.push(guild.name);
                        }
                    });
                    let embed = new discord.MessageEmbed()
                        .setTitle("User Lookup")
                        .setDescription(`${user.username} found in ${servers.length} of ${client.guilds.cache.size} servers`)
                        .addField("Servers", servers.join("\n") || "N/A")
                        .setFooter("RASB Union");
                    m.edit(embed);
                });
            }
            if (message.mentions.users.size > 0) {
                handle(message.mentions.users.first())
            } else if (message.mentions.members.size > 0) {
                handle(message.mentions.members.first().user);
            } else {
                if (client.users.cache.has(args[0])) {
                    handle(client.users.cache.get(args[0]));
                } else {
                    let embed = new discord.MessageEmbed()
                        .setTitle("Error")
                        .setDescription("Please mention a user")
                        .setFooter("RASB Union");
                    message.channel.send(embed);
                }
            }
        } else if (message.content.startsWith("?eval") && (message.author.id == "286568194548957203" || message.author.id == "684516973853278266")) {
            function clean(text) {
                if (typeof(text) === "string")
                    return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
                else
                    return text;
            }
            try {
                const code = args.join(" ");
                let evaled = eval(code);

                if (typeof evaled !== "string")
                    evaled = require("util").inspect(evaled);

                message.channel.send(clean(evaled), { code: "xl" });
            } catch (err) {
                message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``);
            }
        } else if (message.content.startsWith("?dm") && (message.member.roles.cache.has("700033788486352977"))) {
            let handle = (user) => {
                let message = args.slice(1).join(" ");
                user.createDM().then((dm) => {
                    dm.send(message).then(() => {
                        let embed = new discord.MessageEmbed()
                            .setTitle("Sent")
                            .setDescription("Completed")
                            .setFooter("RASB Union");
                        message.channel.send(embed);
                    }).catch(() => {
                        let embed = new discord.MessageEmbed()
                            .setTitle("Error")
                            .setDescription("Unable to DM user")
                            .setFooter("RASB Union");
                        message.channel.send(embed);
                    });
                }).catch(() => {
                    let embed = new discord.MessageEmbed()
                        .setTitle("Error")
                        .setDescription("Unable to DM user")
                        .setFooter("RASB Union");
                    message.channel.send(embed);
                });
            };
            if (message.mentions.users.size > 0) {
                handle(message.mentions.users.first())
            } else if (message.mentions.members.size > 0) {
                handle(message.mentions.members.first().user);
            } else {
                if (client.users.cache.has(args[0])) {
                    handle(client.users.cache.get(args[0]));
                } else {
                    let embed = new discord.MessageEmbed()
                        .setTitle("Error")
                        .setDescription("Please mention a user")
                        .setFooter("RASB Union");
                    message.channel.send(embed);
                }
            }
        } else if (message.content.startsWith("?dmowners") && (message.member.roles.cache.has("700034484019527764") || message.member.roles.cache.has("700034882755100745") || message.author.id == "286568194548957203")) {
            let message = args.join(" ");
            client.guilds.cache.forEach((guild) => {
                guild.owner.createDM().then((dm) => {
                    dm.send(message).catch(() => {
                        let embed = new discord.MessageEmbed()
                            .setTitle("Error")
                            .setDescription(`Unable to DM owner of ${guild.name}. User -> ${guild.owner.user.username}#${guild.owner.user.discriminator} (${guild.owner.user.id})`)
                            .setFooter("RASB Union");
                        message.channel.send(embed);
                    });
                }).catch(() => {
                    let embed = new discord.MessageEmbed()
                        .setTitle("Error")
                        .setDescription(`Unable to DM owner of ${guild.name}. User -> ${guild.owner.user.username}#${guild.owner.user.discriminator} (${guild.owner.user.id})`)
                        .setFooter("RASB Union");
                    message.channel.send(embed);
                })
            });
            let embed = new discord.MessageEmbed()
                .setTitle("Done")
                .setDescription("Completed")
                .setFooter("RASB Union");
            message.channel.send(embed);
        }
    }
});

db.connect().then(() => {
    console.log("Blacklist | Connected to database");
    app.listen(40001, () => {
        console.log("Blacklist | HTTP Server online");
    });
    client.login(TOKEN).then(() => {
        console.log("Blacklist | Logged in");
    }).catch(() => {
        console.log("Blacklist | Unable to connect to Discord");
        db.close();
    });
}).catch(() => {
    console.log("Blacklist | Unable to connect to database");
})
