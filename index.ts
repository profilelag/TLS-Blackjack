import { Database } from "bun:sqlite";
import { createServer, Socket } from "node:net";

const sumOfCards = (cards: Array<Array<any>>) => {
    let sum = 0;
    let aces = 0;
    for(const card of cards) {
        if(card[1] == "A") {
            aces++;
        } else {
            sum += card[0];
        }
    }
    for(let i = 0; i < aces; i++) {
        if(sum + 11 <= 21) {
            sum += 11;
        } else {
            sum += 1;
        }
    }
    return sum;
}
const db = new Database("users.db");
const cards = [[1, "A"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"], [7, "7"], [8, "8"], [9, "9"], [10, "10"], [10, "J"], [10, "Q"], [10, "K"], [11, "A"]];
const server = createServer((socket: Socket) => {
    console.log("Client connected");
    var info = {
        token: "e13162be401bd8",
        game: {
            dealer: [cards[0], cards[0]],
            player: [cards[0], cards[0]],
            bet: 0
        },
        gameMode: false
    }
    socket.write("Welcome to the blackjack server!\r\n");
    socket.write("Please login to play.\r\n");
    socket.write("Type /? for help.\r\n");
    socket.on("data", (d) => {
        const data: String=d.toString().trim();
        console.log("Received:", data);
        if(info.game.bet != 0) {
            if(data == "/hit") {
                info.game.player.push(cards[Math.floor(Math.random() * cards.length)]);
                socket.write("Player: " + info.game.player.map(c => c[1]).join(" ") + "\r\n");
                if(sumOfCards(info.game.player) > 21) {
                    socket.write("Bust! You lost $" + info.game.bet + ".\r\n");
                    //@ts-ignore
                    db.query(`UPDATE players SET balance = balance - ${info.game.bet} WHERE token = '${info.token}'`);
                    info.game = {
                        dealer: [cards[0], cards[0]],
                        player: [cards[0], cards[0]],
                        bet: 0
                    }
                } else if(sumOfCards(info.game.player) == 21) {
                    socket.write("21! Type /stand to end your turn.\r\n");
                }
            }
            if(data == "/stand") {
                while(sumOfCards(info.game.dealer) < 17) {
                    info.game.dealer.push(cards[Math.floor(Math.random() * cards.length)]);
                }
                socket.write("Dealer: " + info.game.dealer.map(c => c[1]).join(" ") + "\r\n");
                if(sumOfCards(info.game.dealer) > 21 || sumOfCards(info.game.player) > sumOfCards(info.game.dealer)) {
                    socket.write("You won $" + info.game.bet + ".\r\n");
                    //@ts-ignore
                    db.query(`UPDATE players SET balance = ${db.query(`SELECT balance FROM players WHERE token = '${info.token}'`).get().balance+info.game.bet} WHERE token = '${info.token}'`).run();
                } else if(sumOfCards(info.game.player) < sumOfCards(info.game.dealer)) {
                    socket.write("You lost $" + info.game.bet + ".\r\n");
                    //@ts-ignore
                    db.query(`UPDATE players SET balance = ${db.query(`SELECT balance FROM players WHERE token = '${info.token}'`).get().balance-info.game.bet} WHERE token = '${info.token}'`).run();
                } else {
                    socket.write("It's a tie.\r\n");
                }
                info.game = {
                    dealer: [cards[0], cards[0]],
                    player: [cards[0], cards[0]],
                    bet: 0
                }
            }
        }
        else if(data == "/token") {
            socket.write("Your token is " + info.token + ".\r\n");
        }
        else if(data == "/?") {
            socket.write("Commands:\r\n");
            socket.write("/login <token> - Login to the server\r\n");
            socket.write("/register <name> - Register a new account\r\n");
            socket.write("/logout - Logout of the server\r\n");
            socket.write("/balance - Check your balance\r\n");
            socket.write("/newgame <bet> - Start a new game\r\n");
            socket.write("/leaderboard - View the leaderboard\r\n");
        }
        else if(data.startsWith("/login")) {
            if(info.token != "") {
                socket.write("You are already logged in.\r\n");
            } else {
                const token = data.split(" ")[1];
                //@ts-ignore
                const user = db.query("SELECT * FROM players WHERE token = ?", token);
                //@ts-ignore
                if(user.length == 0) {
                    socket.write("Invalid token.\r\n");
                } else {
                    info.token = token;
                    socket.write("Logged in successfully.\r\n");
                }
            }
        }
        else if(data.startsWith("/register")) {
            if(info.token != "") {
                socket.write("You are already logged in.\r\n");
            } else {
                const name = data.substring(data.indexOf(' ')+1)
                // 24 length base16 token
                const token = Math.random().toString(16).substring(2, 26);
                //@ts-ignore
                db.run("INSERT INTO players (name, token, balance) VALUES (?, ?, ?)", name, token, 1000);
                socket.write("Registered successfully. Your token is " + token + "\r\n");
                socket.write("Warning, this token is your only way to access your account. Keep it safe.\r\n");
                socket.write("Logged in successfully.\r\n");
                info.token = token;
            }
        }
        else if(data == "/logout") {
            if(info.token == "") {
                socket.write("You are not logged in.\r\n");
            } else {
                info.token = "";
                socket.write("Logged out successfully.\r\n");
            }
        }
        else if(data == "/balance" || data == "/bal") {
            if(info.token == "") {
                socket.write("You are not logged in.\r\n");
            } else {
                //@ts-ignore
                const user = db.query(`SELECT balance FROM players WHERE token = '${info.token}'`).get().balance;
                //@ts-ignore
                socket.write("Your balance is $" + user + ".\r\n");
            }
        }
        else if(data.startsWith("/newgame")) {
            if(info.token == "") {
                socket.write("You are not logged in.\r\n");
            } else {
                if(data.split(" ").length < 2 || isNaN(parseInt(data.split(" ")[1])) || parseInt(data.split(" ")[1]) <= 0) {
                    socket.write("Please specify a bet.\r\n");
                }
                //@ts-ignore
                else if(parseInt(data.split(" ")[1]) > db.query(`SELECT balance FROM players WHERE token = '${info.token}'`).get().balance) {
                    socket.write("You don't have enough money.\r\n");
                } else {
                    info.game = {
                        dealer: [cards[Math.floor(Math.random() * cards.length)], cards[Math.floor(Math.random() * cards.length)]],
                        player: [cards[Math.floor(Math.random() * cards.length)], cards[Math.floor(Math.random() * cards.length)]],
                        bet: parseInt(data.split(" ")[1])
                    }
                    socket.write("New game started.\r\n");
                    socket.write("Dealer: " + info.game.dealer[0][1] + " ?\r\n");
                    socket.write("Player: " + info.game.player[0][1] + " " + info.game.player[1][1] + "\r\n");
                    if(sumOfCards(info.game.player) == 21) {
                        socket.write("Blackjack! You won $" + info.game.bet * 1.5 + ".\r\n");
                        //@ts-ignore
                        db.query(`UPDATE players SET balance = ${db.query(`SELECT balance FROM players WHERE token = '${info.token}'`).get().balance + info.game.bet * 1.5} WHERE token = '${info.token}'`).run();
                        info.game = {
                            dealer: [cards[0], cards[0]],
                            player: [cards[0], cards[0]],
                            bet: 0
                        }
                    } else {
                        socket.write("Type /hit to draw a card or /stand to end your turn.\r\n");
                    }
                }
            }
        }
        else {
            socket.write("Unknown command. Type /? for help.\r\n");
        }
    });
    socket.on("end", () => {
        console.log("Client disconnected");
    });
});
server.listen(23, "::")