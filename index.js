const { Client, IntentsBitField } = require("discord.js");
const token = process.env["BOT_TOKEN"];
const { sendAsset } = require('./algorand');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

const ongoingGames = {};
const userAddresses = {};

const rewardAmount = 1000000; // 1 Algo in microAlgos
const choices = ["rock", "paper", "scissors"];

client.on("ready", (c) => {
  console.log(`${c.user.tag} is online`);
});

function getBotChoice() {
  return choices[Math.floor(Math.random() * choices.length)];
}

function determineRoundResult(userChoice, botChoice) {
  if (userChoice === botChoice) return "draw";
  if (
    (userChoice === "rock" && botChoice === "scissors") ||
    (userChoice === "scissors" && botChoice === "paper") ||
    (userChoice === "paper" && botChoice === "rock")
  ) return "user";
  return "bot";
}

async function handleReward(interaction) {
  if (userAddresses[interaction.user.id]) {
    const userAddress = userAddresses[interaction.user.id];
    try {
      await sendAsset(userAddress, rewardAmount);
      return "\n\nYou have been rewarded with PHTM tokens!";
    } catch (err) {
      console.error("Error sending Algo:", err);
      return "\n\nThere was an issue rewarding you with PHTM tokens. Please try again later.";
    }
  } else {
    return "\n\nPlease set your Algorand address using the `/setaddress` command to receive rewards.";
  }
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  switch (interaction.commandName) {
    case "invite":
      const inviteLink = 'https://discord.com/api/oauth2/authorize?client_id=1157322558966857808&permissions=17877801569345&scope=bot%20applications.commands';
      await interaction.reply(`Click [here](${inviteLink}) to invite the bot to your server!`);
      break;
    case "setaddress":
      const address = interaction.options.getString('address');
      userAddresses[interaction.user.id] = address;
      await interaction.reply(`Your Algorand address has been set to ${address}`);
      // ask user to Opt-in to the token 
      try {
        await interaction.followUp('Please ensure you have opted-in for the PHTM token with Asset ID 402192759 to receive rewards!.');
      } catch (error) {
        console.error(error);
      }
      break;

    case "rps":
      const userChoice = interaction.options.getString("choice");
      const botChoice = getBotChoice();
      let result = "";
      if (!userAddresses[interaction.user.id]) {
        return interaction.reply({
          content: "Please set your Algorand address using the `/setaddress` command before playing.",
          ephemeral: true,
        });
      }
      if (!ongoingGames[interaction.user.id]) {
        ongoingGames[interaction.user.id] = { score: [0, 0], roundsPlayed: 0 };
        result = "Welcome to Rock, Paper, Scissors - Best of Three!\n\n";
        result += "Here's how to play:\n";
        result += "1. Use the `/rps` command followed by your choice (rock, paper, or scissors).\n";
        result += "2. After three rounds, the winner will be announced.\n\n";
        result += `Your first choice was ${userChoice}.\n\n`;
      }

      const roundResult = determineRoundResult(userChoice, botChoice);

      if (roundResult === "draw") {
        result += "This round is a draw!";
      } else if (roundResult === "user") {
        result += `You win this round! I chose ${botChoice}.`;
        ongoingGames[interaction.user.id].score[0]++;
      } else {
        result += `You lose this round! I chose ${botChoice}.`;
        ongoingGames[interaction.user.id].score[1]++;
      }

      const [userScore, botScore] = ongoingGames[interaction.user.id].score;
      ongoingGames[interaction.user.id].roundsPlayed++;

      if (ongoingGames[interaction.user.id].roundsPlayed === 2 && (userScore === 2 || botScore == 2)) {
        result += userScore > botScore ? "\n\nYou've won without needing a third round! Congratulations!" : "\n\nI've won without needing a third round! Boooo!";
        delete ongoingGames[interaction.user.id];
        if (result.includes("You've won")) {
          result += await handleReward(interaction);
        }
        return await interaction.reply(result);
      }

      if (ongoingGames[interaction.user.id].roundsPlayed === 3) {
        result += userScore > botScore ? "\n\nYou've won the best of three! Congratulations!" : botScore > userScore ? "\n\nYou've lost the best of three. Better luck next time!" : "\n\nIt's a draw in the best of three!";
        delete ongoingGames[interaction.user.id];
        if (result.includes("You've won")) {
          result += await handleReward(interaction);
        }
      } else {
        result += `\n\nScore: You - ${userScore}, Bot - ${botScore}`;
      }

      await interaction.reply(result);
      break;
  }
});

client.login(token);
