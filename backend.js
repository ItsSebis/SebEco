// data vars
const fs = require('fs');
const bcrypt = require('bcrypt');

// update vars
let lastDayCk = 0

// webserver setup
const express = require('express')
const cookieParser = require('cookie-parser')
const backend = express()
backend.use(cookieParser());
const port = 7878
const http = require('http')
const { Server } = require('socket.io')
const {set} = require("express/lib/application");
const server = http.createServer(backend)
const io = new Server(server, {pingInterval: 1500, pingTimeout: 5000})

backend.use(express.static("./public"))
backend.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html')
});
backend.get('/setcookie', (req, res) => {
    res.cookie(`Cookie token name`,`encrypted cookie string Value`);
    res.send('Cookie have been saved successfully');
});
backend.get('/getcookie', (req, res) => {
    //show the saved cookies
    console.log(req.cookies)
    res.send(req.cookies);
});

// public vars
let updating = false
let users = {}
let pubStats = {}

// backend vars
let passwords = {}
const skel = {
    balance: 1000,
    inventory: {},
    offers: {},
    special: "apple",
    newSpecial: "apple",
}
const perishable = ["apple", "banana", "carrots"]
const allItems = perishable + []
const socketUser = {}
const userSocket = {}

// read data from file
fs.readFile('./data.json', 'utf8', (err, fileData) => {
    if (!err) {
        const data = JSON.parse(fileData)
        if (data.users !== undefined) {
            users = data.users
        }
        if (data.stats !== undefined) {
            pubStats = data.stats
        }
        if (data.passwords !== undefined) {
            passwords = data.passwords
        }
        if (data.lastDayCk !== undefined) {
            lastDayCk = data.lastDayCk
        }
        saveData()
        console.log("Loaded data!");
        update().then()
    } else {
        throw err;
    }
})

// code
io.on('connection', (socket) => {
    // client connected
    socketUser[socket.id] = null
    console.log(socket.id + " connected!")

    // auth
    socket.on('auth', (credentials) => {
        if (updating) {
            socket.emit('lError', "Update läuft, versuchen Sie es später erneut!")
            return
        }
        if (users[credentials.user] === undefined) {
            socket.emit('lError', "Account existiert nicht!")
            return
        }
        bcrypt.compare(credentials.password, passwords[credentials.user], function(err, result) {
            if (result) {
                // user authenticated
                if (userSocket[credentials.user] !== undefined) {
                    io.to(userSocket[credentials.user]).emit('kick')
                }
                socket.join('authenticated')
                socketUser[socket.id] = credentials.user
                userSocket[credentials.user] = socket.id
                socket.emit('login', credentials.user)
                socket.emit('update', {users: users})
                io.to('authenticated').emit('setOnline', Object.keys(userSocket))
                console.log(credentials.user + " authenticated on " + socket.id)
            } else {
                // user authentication failed
                socket.emit('lError', "Ungültige Anmeldedaten!")
                console.log(credentials.user + " failed to authenticate on " + socket.id)
            }
        });
    })

    // set password
    socket.on('pw', (data) => {
        if (socketUser[socket.id] === null) {
            socket.emit('kick')
            return
        }
        bcrypt.compare(data.old, passwords[socketUser[socket.id]], function(err, result) {
            if (result) {
                // user authenticated
                setPassword(socketUser[socket.id], data.new)
                socket.emit('pwChS')
            } else {
                // user authentication failed
                socket.emit('pwChF', "Falsches Passwort!")
            }
        });
    })

    // reset user password
    socket.on('resetPw', (user) => {
        if (socketUser[socket.id] === null) {
            socket.emit('kick')
            return
        }
        if (user === "sebi" || users[user] === undefined || socketUser[socket.id] !== "sebi") {
            return
        }
        const newPw = Math.round(Math.random() * (999999-100000) + 100000)
        setPassword(user, newPw)
        socket.emit('resetPwResult', "Passwort von '" + user + "' gesetzt auf `" + newPw + "`")
    })

    // create user request
    socket.on('createUser', (username) => {
        if (socketUser[socket.id] === null) {
            socket.emit('kick')
            return
        }
        if (username === "" || username === null || username === undefined || socketUser[socket.id] !== "sebi"
            || users[username] !== undefined) {
            return
        }
        users[username] = skel
        users[username].username = username
        const newPw = Math.round(Math.random() * (999999-100000) + 100000)
        setPassword(username, newPw)
        socket.emit('resetPwResult', "Benutzer '" + username + "' erstellt mit Passwort `" + newPw + "`")
    })

    // offer item by user
    socket.on('offerItem', (offer) => {
        if (socketUser[socket.id] === null) {
            socket.emit('kick')
            return
        }
        const seller = socketUser[socket.id]
        const product = offer.item
        const price = offer.price

        if (users[seller].offers === undefined) {
            users[seller].offers = {}
        }
        users[seller].offers[product] = price
        saveData()
    })
    socket.on('removeOffer', (product) => {
        if (socketUser[socket.id] === null) {
            socket.emit('kick')
            return
        }
        if (users[socketUser[socket.id]].offers[product] !== undefined) {
            delete users[socketUser[socket.id]].offers[product]
        }
        saveData()
    })
    socket.on('buyOffer', (conditions) => {
        if (socketUser[socket.id] === null) {
            socket.emit('kick')
            return
        }
        const buyer = socketUser[socket.id]
        const seller = conditions.seller
        const product = conditions.product
        if (users[seller].offers === undefined || users[seller].offers[product] === undefined) {
            socket.emit('cannotBuy', "Angebot existiert nicht mehr!")
            return
        }
        const price = users[seller].offers[product]

        if (users[buyer].balance < price) {
            socket.emit('cannotBuy', "Nicht genug Geld!")
            return
        }
        if (users[seller].inventory[product] === undefined || users[seller].inventory[product] <= 0) {
            socket.emit('cannotBuy', "Ausverkauft!")
            if (users[seller].inventory[product] !== undefined) {
                delete users[buyer].inventory[product]
            }
            delete users[seller].offers[product]
            return
        }

        if (users[buyer].inventory[product] === undefined) {
            users[buyer].inventory[product] = 1
        } else {
            users[buyer].inventory[product] = users[buyer].inventory[product]+1
        }

        if (users[seller].inventory[product] <= 1) {
            delete users[seller].inventory[product]
        } else {
            users[seller].inventory[product] = users[seller].inventory[product]-1
        }

        users[seller].balance += price
        users[buyer].balance -= price

        if (pubStats.items === undefined) {
            pubStats.items = {}
        }
        if (pubStats.items[product] === undefined) {
            pubStats.items[product] = {}
        }
        if (pubStats.items[product][price] === undefined) {
            pubStats.items[product][price] = 0
        }
        pubStats.items[product][price]++

        saveData()
    })

    // simulate update -> dev
    socket.on('getUpdate', () => {
        if (socketUser[socket.id] === null) {
            socket.emit('kick')
            return
        }
        io.to('authenticated').emit('update', {users: users})
    })

    socket.on('disconnect', (reason) => {
        console.log("Client disconnected: " + reason)
        if (userSocket[socketUser[socket.id]] === socket.id) {
            delete userSocket[socketUser[socket.id]]
        }
        delete socketUser[socket.id]
        io.to('authenticated').emit('setOnline', Object.keys(userSocket))
    })
})

// functions
// set password for user
function setPassword(user, password) {
    bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash(password.toString(), salt, function(err, hash) {
            // Store hash in your password DB.
            if (err) throw err;
            passwords[user] = hash
            saveData()
        });
    });
}

// write data to file
function saveData() {
    io.to('authenticated').emit('update', {users: users})
    const data = {
        users: users,
        stats: pubStats,
        passwords: passwords,
        lastDayCk: lastDayCk,
    }
    fs.writeFile('./data.json', JSON.stringify(data), err => {
        if (err) {
            console.error(err)
        }
        console.log("Saved data!")
    })
}

// listen
server.listen(port, "0.0.0.0", () => {
    console.log(`Listening for connections on ${port}`)
})

async function update() {
    const startTime = Date.now()
    // update
    const lastDayCkDate = new Date(lastDayCk)
    const now = new Date(startTime)
    if (
        lastDayCkDate.getDate() !== now.getDate() ||
        lastDayCkDate.getMonth() !== now.getMonth() ||
        lastDayCkDate.getFullYear() !== now.getFullYear()
    ) {
        // new day
        updating = true
        io.emit('kick')
        setTimeout(function () {
            io.emit('kick')
        }, 100)
        for (const uid in users) {
            // waste of intolerable goods
            for (const iid in users[uid].inventory) {
                if (perishable.includes(iid)) {
                    let count = users[uid].inventory[iid]
                    count = Math.round((Math.random() * (1/4) + 3/4) * count)
                    users[uid].inventory[iid] = count
                }
                if (users[uid].inventory[iid] <= 0) {
                    delete users[uid].inventory[iid]
                }
            }

            if (users[uid].newSpecial !== undefined) {
                users[uid].special = users[uid].newSpecial
            }
            // give new price
            let avg = 5
            users[uid].todayPrice = Math.round((Math.random() * (1/10*avg) + (avg - (1/20*avg))) * 100) / 100
            users[uid].greatBuy = false
        }
        lastDayCk = startTime
        saveData()
        updating = false
        console.log("New Day!")
    }

    const nextTime = now
    nextTime.setMinutes(nextTime.getMinutes()+1)
    nextTime.setSeconds(0)
    nextTime.setMilliseconds(0)
    let timeout = Date.parse(nextTime.toUTCString())-Date.now()
    if (timeout <= 0) {
        timeout = 0
    }

    setTimeout(function () {
        update()
    }, timeout)
}