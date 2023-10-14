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
const server = http.createServer(backend)
const io = new Server(server, {pingInterval: 1500, pingTimeout: 5000})

backend.use(express.static("./public"))
backend.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html')
});
backend.get('/stats', (req, res) => {
    res.sendFile(__dirname + '/public/charts.html')
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

// backend vars
let passwords = {sebi: "$2y$10$Yz7An.DFEOoBvFzcfSTa/uYR/wecld17rDNUTyTz5Ugk18hkTUkgC"}
const skel = {
    balance: 1000,
    invLvl: 1,
    inventory: {},
    offers: {},
    special: "apple",
    newSpecial: "apple",
}
const perishable = ["apple", "banana", "carrots", "dattel", "strawberry", "grapefruit", "orange", "mango"]
const fungible = perishable.concat(["metal", "wood"])
const allItems = fungible.concat(["diamond"])
const bonus = {
    apple: [5, 1],
    banana: [4.75, 1.25],
    carrots: [6.6, 0.4],
    dattel: [4.5, 1.15],
    strawberry: [8, 0.2],
    grapefruit: [4.8, 1.2],
    orange: [4.85, 1.15],
    mango: [5.2, 0.8],

    metal: [0, 1],
    wood: [0, 1],

    diamond: [25, 0.6],
}
const events = {
    storm: {
        storageBroke: {
            metal: [2, 6],
            wood: [4, 10]
        },
        text: "Ein Sturm hat über Nacht dein Lager zerstört!"
    },
    productiveProduction: {
        text: "Die Lieferanten haben noch viel auf Lager!",
        greatFactor: [0.75, 0.85]
    },
    poorProduction: {
        text: "Die Lieferanten leiden unter Lieferschwierigkeiten!",
        greatFactor: [1.15, 1.25]
    },
    noProduction: {
        text: "Das Schiff auf dem die Waren geliefert werden sollten, steckt im Ärmelkanal!",
        greatStop: true
    }
}
const invLevels = {
    1: {
        stacks: 2,
        stackSize: 16,
    },
    2: {
        stacks: 3,
        stackSize: 16,
        metal: 8,
        wood: 10,
    },
    3: {
        stacks: 3,
        stackSize: 20,
        metal: 10,
        wood: 12,
    },
    4: {
        stacks: 4,
        stackSize: 20,
        metal: 12,
        wood: 14,
    },
    5: {
        stacks: 4,
        stackSize: 24,
        metal: 14,
        wood: 16,
    },
    6: {
        stacks: 5,
        stackSize: 24,
        metal: 16,
        wood: 18,
    },
    7: {
        stacks: 5,
        stackSize: 28,
        metal: 18,
        wood: 20,
    },
    8: {
        stacks: 6,
        stackSize: 28,
        metal: 20,
        wood: 22,
    },
    9: {
        stacks: 6,
        stackSize: 32,
        metal: 22,
        wood: 24,
    },
}
const tax = 19 // percentage
const socketUser = {}
const userSocket = {}

// public vars
let updating = false
let users = {sebi: skel}
let pubStats = {}
let statsArchive = {}

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
        if (data.oldStats !== undefined) {
            statsArchive = data.oldStats
        }
        if (data.passwords !== undefined) {
            passwords = data.passwords
        }
        if (data.lastDayCk !== undefined) {
            lastDayCk = data.lastDayCk
        }

        if (statsArchive.diamond === undefined) {
            statsArchive.diamond = false
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
                socket.emit('update', {users: users, diamond: statsArchive.diamond, volumes: getVolumes()})
                io.to('authenticated').emit('setOnline', Object.keys(userSocket))
                console.log(credentials.user + " authenticated on " + socket.id)
            } else {
                // user authentication failed
                socket.emit('lError', "Ungültige Anmeldedaten!")
                console.log(credentials.user + " failed to authenticate on " + socket.id)
            }
        });
    })

    // charts client
    socket.on('requestStats', () => {
        socket.join('charts')
        sendStats(socket.id)
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
        users[username].todayPrice = calcAveragePrice(skel.special)

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
        const price = Math.round(offer.price*100)/100

        if (users[seller].offers === undefined) {
            users[seller].offers = {}
        }
        users[seller].offers[product] = price
        sendUpdate()
    })
    socket.on('removeOffer', (product) => {
        if (socketUser[socket.id] === null) {
            socket.emit('kick')
            return
        }
        if (users[socketUser[socket.id]].offers[product] !== undefined) {
            delete users[socketUser[socket.id]].offers[product]
        }
        sendUpdate()
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
            sendUpdate()
            return
        }
        if (!invSpaceTest(buyer, product, 1)) {
            socket.emit('cannotBuy', "Kein Platz im Lager!")
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

        users[seller].balance += price-(price*(tax/100))
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

        if (users[seller].stats === undefined) {
            users[seller].stats = {}
        }
        if (users[seller].stats.profit === undefined) {
            users[seller].stats.profit = 0
        }
        users[seller].stats.profit += price-(price*(tax/100))

        if (users[buyer].stats === undefined) {
            users[buyer].stats = {}
        }
        if (users[buyer].stats.profit === undefined) {
            users[buyer].stats.profit = 0
        }
        users[buyer].stats.profit -= price

        if (pubStats.trades === undefined) {
            pubStats.trades = {}
        }
        if (pubStats.trades[seller] === undefined) {
            pubStats.trades[seller] = []
        }
        if (!pubStats.trades[seller].includes(buyer)) {
            pubStats.trades[seller].push(buyer)
        }
        if (pubStats.trades[buyer] === undefined) {
            pubStats.trades[buyer] = []
        }
        if (!pubStats.trades[buyer].includes(seller)) {
            pubStats.trades[buyer].push(seller)
        }
        sendUpdate()
    })

    // buy on the great market
    socket.on('buyGreat', (quantity) => {
        if (socketUser[socket.id] === null) {
            socket.emit('kick')
            return
        }
        quantity = parseInt(quantity)
        const buyer = socketUser[socket.id]
        const product = users[buyer].special
        const pricePP = users[buyer].todayPrice
        const price = Math.round(pricePP*quantity*100)/100

        if (users[buyer].greatBuy) {
            return;
        }
        if (price > users[buyer].balance) {
            socket.emit('greatFail', "Du hast nicht genug Geld!")
            return
        }
        if (!invSpaceTest(buyer, product, quantity)) {
            socket.emit('greatFail', "Dein Inventar kann nicht so viel aufnehmen!")
            return;
        }

        if (users[buyer].inventory[product] === undefined) {
            users[buyer].inventory[product] = 0
        }
        users[buyer].inventory[product] += quantity
        users[buyer].balance -= price
        users[buyer].greatBuy = true

        if (users[buyer].stats === undefined) {
            users[buyer].stats = {}
        }
        if (users[buyer].stats.profit === undefined) {
            users[buyer].stats.profit = 0
        }
        users[buyer].stats.profit -= price

        sendUpdate()
    })

    // change great market special
    socket.on('changeSpecial', (newSpecial) => {
        if (socketUser[socket.id] === null) {
            socket.emit('kick')
            return
        }
        if (!fungible.includes(newSpecial)) {
            console.log("All items does not include " + newSpecial)
            return;
        }
        users[socketUser[socket.id]].newSpecial = newSpecial
        sendUpdate()
    })

    // try to repair storage
    socket.on('repairStorage', () => {
        if (socketUser[socket.id] === null) {
            socket.emit('kick')
            return
        }

        const target = socketUser[socket.id]
        if (
            users[target].storageBroke === undefined ||
            users[target].inventory.metal === undefined ||
            users[target].inventory.wood === undefined ||
            users[target].inventory.metal < users[target].storageBroke.metal ||
            users[target].inventory.wood < users[target].storageBroke.wood
        ) {
            socket.emit('log', "Insufficient mats")
            return
        }
        users[target].inventory.metal -= users[target].storageBroke.metal
        if (users[target].inventory.metal === 0) {
            delete users[target].inventory.metal
        }
        users[target].inventory.wood -= users[target].storageBroke.wood
        if (users[target].inventory.wood === 0) {
            delete users[target].inventory.wood
        }

        delete users[target].storageBroke
        delete users[target].motd

        sendUpdate()
    })

    // try to upgrade inventory
    socket.on('upgradeInv', () => {
        if (socketUser[socket.id] === null) {
            socket.emit('kick')
            return
        }

        const target = socketUser[socket.id]
        if (users[target].invLvl === undefined) {
            users[target].invLvl = 1
        }
        if (users[target].invLvl+1 > Object.keys(invLevels)) {
            socket.emit('log', "Maxed")
            return
        }
        if (
            users[target].inventory.metal === undefined ||
            users[target].inventory.wood === undefined ||
            users[target].inventory.metal < invLevels[users[target].invLvl+1].metal ||
            users[target].inventory.wood < invLevels[users[target].invLvl+1].wood
        ) {
            socket.emit('log', "Insufficient mats")
            return
        }
        users[target].inventory.metal -= invLevels[users[target].invLvl+1].metal
        if (users[target].inventory.metal === 0) {
            delete users[target].inventory.metal
        }
        users[target].inventory.wood -= invLevels[users[target].invLvl+1].wood
        if (users[target].inventory.wood === 0) {
            delete users[target].inventory.wood
        }

        users[target].invLvl += 1

        sendUpdate()
    })

    // claim spawned diamond
    socket.on('claimDiamond', () => {
        if (socketUser[socket.id] === null) {
            socket.emit('kick')
            return
        }
        if (!invSpaceTest(socketUser[socket.id], "diamond", 1)) {
            socket.emit('greatFail', "Dein Lager ist voll!")
            return
        }
        if (statsArchive.diamond !== undefined && statsArchive.diamond === true) {
            if (users[socketUser[socket.id]].inventory['diamond'] === undefined) {
                users[socketUser[socket.id]].inventory['diamond'] = 1
            } else {
                users[socketUser[socket.id]].inventory['diamond'] += 1
            }
            statsArchive.diamond = false
            sendUpdate()
        }
    })

    // secret for sebi :)
    socket.on('setAttribute', (args) => {
        if (socketUser[socket.id] === null || socketUser[socket.id] !== 'sebi') {
            return
        }
        if (args.key === undefined || args.key === null || args.value === undefined || args.value === null) {
            socket.emit('log', "You forgot a required ingredient, Sebi!")
            return
        }
        let target = 'sebi'
        if (args.user !== undefined) {
            target = args.user
            if (users[target] === undefined) {
                socket.emit('log', "The given user does not exist!")
                return;
            }
        }
        const originalValue = users[target][args.key]
        users[target][args.key] = args.value
        socket.emit('log', "Changed " + target + "'s key '" + args.key + "' from '" + originalValue +
            "' (" + typeof originalValue + ") to '" + args.value + "' (" + typeof args.value + ")")
        sendUpdate()
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

// listen
server.listen(port, "0.0.0.0", () => {
    console.log(`Listening for connections on ${port}`)
})

// functions
// set password for user
function setPassword(user, password) {
    bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash(password.toString(), salt, function(err, hash) {
            // Store hash in your password DB.
            if (err) throw err;
            passwords[user] = hash
        });
    });
}

// write data to file
function saveData() {
    const data = {
        users: users,
        stats: pubStats,
        oldStats: statsArchive,
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

function getVolumes() {
    let totalMoneyVolume = 0
    let totalItemVolume = 0
    for (const uid in users) {
        totalMoneyVolume += users[uid].balance
        for (const iid in users[uid].inventory) {
            totalItemVolume += calcHistoryAveragePrice(iid)*users[uid].inventory[iid]
        }
    }
    return {money: totalMoneyVolume, items: totalItemVolume}
}

function getDefaultPrice(product) {
    if (perishable.includes(product)) {
        return 5
    } else if (fungible.includes(product)) {
        return 10
    } else {
        return 100
    }
}

function calcAveragePrice(product, setArchive) {
    if (pubStats.items === undefined) {
        return getDefaultPrice(product)
    }

    let productVolume = 0
    let sales = 0
    if (pubStats.items[product] !== undefined) {
        const pData = pubStats.items[product]

        for (const price in pData) {
            productVolume += price * pData[price]
            sales += pData[price]
        }
    }

    if (sales !== 0) {
        const avg = productVolume / sales

        if (setArchive === true) {
            if (statsArchive.currentAvg === undefined) {
                statsArchive.currentAvg = {}
            }
            statsArchive.currentAvg[product] = avg
        }

        return avg;
    } else {
        if (statsArchive.currentAvg === undefined || statsArchive.currentAvg[product] === undefined) {
            return getDefaultPrice(product);
        } else {
            return statsArchive.currentAvg[product]
        }
    }
}

function calcHistoryAveragePrice(product) {
    if (statsArchive.items === undefined) {
        return calcAveragePrice(product, false)
    }

    const itemsHistory = statsArchive.items
    let productVolume = 0
    let sales = 0
    for (const date in itemsHistory) {
        if (itemsHistory[date][product] === undefined) {
            continue
        }
        const pData = itemsHistory[date][product]
        for (const price in pData) {
            productVolume += price*pData[price]
            sales += pData[price]
        }
    }

    if (sales !== 0) {
        return productVolume / sales;
    } else {
        return calcAveragePrice(product, false);
    }
}

// does another fit?
function invSpaceTest(uid, iid, count) {
    const inv = users[uid].inventory
    let invLvl = 1
    if (users[uid].invLvl !== undefined) {
        invLvl = users[uid].invLvl
    } else {
        users[uid].invLvl = 1
    }
    const levelStats = invLevels[invLvl]

    if (inv[iid] !== undefined) {
        return inv[iid]+count <= levelStats.stackSize
    } else {
        return Object.keys(inv).length < levelStats.stacks && count <= levelStats.stackSize
    }
}

function sendStats(target='charts') {
    io.to(target).emit('updateStats', {cur: pubStats, arch: statsArchive, allItems: allItems})
}

function sendUpdate() {
    io.to('authenticated').emit('update', {users: users, diamond: statsArchive.diamond, volumes: getVolumes()})
    sendStats()
}

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

        for (const item of allItems) {
            calcAveragePrice(item, true)
        }

        const volumes = getVolumes()
        let balanceMultiplier = ((Object.keys(users).length*1000/(volumes.money+volumes.items))+1)/2

        console.log("Total market volumes:")
        console.log("  Money: " + volumes.money)
        console.log("  Items: " + volumes.items)
        console.log("  Balancing Multiplier: " + balanceMultiplier)
        if (isNaN(balanceMultiplier) || !isFinite(balanceMultiplier)) {
            balanceMultiplier = 1
        }

        if (statsArchive.users === undefined) {
            statsArchive.users = {}
        }
        statsArchive.users[startTime] = {}

        // choose event
        let event
        const eventPercentage = 100-100*(0.95**Object.keys(events).length)
        if (Math.random()*100 < eventPercentage) {
            const chosenEventId = Math.round(Math.random()*(Object.keys(events).length-1))
            const eventStr = Object.keys(events)[chosenEventId]
            event = events[eventStr]
        }

        for (const uid in users) {
            // user stuff

            delete users[uid].motd
            delete users[uid].greatFactor
            delete users[uid].greatStop

            // apply event
            if (event !== undefined) {
                users[uid].motd = event.text
                if (event.storageBroke !== undefined) {
                    users[uid].storageBroke = {
                        metal: Math.round(Math.random() * (event.storageBroke.metal[1] - event.storageBroke.metal[0]) + event.storageBroke.metal[0]),
                        wood: Math.round(Math.random() * (event.storageBroke.wood[1] - event.storageBroke.wood[0]) + event.storageBroke.wood[0]),
                    }
                }
                if (event.greatFactor !== undefined) {
                    users[uid].greatFactor = Math.random() * (event.greatFactor[1] - event.greatFactor[0]) + event.greatFactor[0]
                }
                if (event.greatStop !== undefined) {
                    users[uid].greatStop = true
                }
            }

            // bonuses for trading with multiple players
            if (pubStats.trades !== undefined && pubStats.trades[uid] !== undefined) {
                const tradePartner = pubStats.trades[uid]

                const count = tradePartner.length
                const partnerBonus = 5 + count * ((9 + count ** 1.11328275256 + 30) / Object.keys(users).length * (count / Object.keys(users).length))
                // old: f(x) = x+(6*0.8^x)*x
                // new: f(x) = 5 + x ((9 + x ** 1.11328275256 + 30) / Object.keys(users).length * (count / Object.keys(users).length)

                users[uid].balance += Math.round(partnerBonus*balanceMultiplier*100)/100
                pubStats.trades[uid] = []
            }

            // waste of intolerable goods and bonuses for non-special items
            for (const iid in users[uid].inventory) {
                if (iid !== users[uid].special) {
                    users[uid].balance += (bonus[iid][0]*users[uid].inventory[iid])**bonus[iid][1]*balanceMultiplier
                }
                if (perishable.includes(iid)) {
                    let count = users[uid].inventory[iid]
                    if (users[uid].storageBroke !== undefined) {
                        count *= 0.5
                    }
                    count = Math.round((Math.random() * (1/8) + 1/3) * count)
                    users[uid].inventory[iid] = count
                }
                if (users[uid].inventory[iid] <= 0) {
                    delete users[uid].inventory[iid]
                }
            }

            if (users[uid].newSpecial !== undefined && fungible.includes(users[uid].newSpecial)) {
                users[uid].special = users[uid].newSpecial
            }
            // give new price
            let avg = calcAveragePrice(users[uid].special, false)
            let greatFactor = 1
            if (users[uid].greatFactor !== undefined) {
                greatFactor = users[uid].greatFactor
            }
            users[uid].todayPrice = Math.round((Math.random() * (1/11*avg) + (avg - (1/15*avg))*greatFactor) * 100) / 100

            users[uid].greatBuy = users[uid].greatStop !== undefined;

            // archive user data
            statsArchive.users[startTime][uid] = users[uid]
        }
        if (pubStats.items !== undefined && Object.keys(pubStats.items).length > 0) {
            if (statsArchive.items === undefined) {
                statsArchive.items = {}
            }
            statsArchive.items[startTime] = pubStats.items
            pubStats.items = {}
        }
        lastDayCk = startTime
        updating = false
        console.log("New Day!")
    }

    // every minute
    if (Math.round(Math.random()*7200) === 787) {
        // spawn diamond to claim
        console.log("Diamond spawned")
        statsArchive.diamond = true
    }

    // save data & update charts
    saveData()

    const nextTime = now
    nextTime.setMinutes(nextTime.getMinutes()+1)
    nextTime.setSeconds(0)
    nextTime.setMilliseconds(0)
    console.log(Date.now()-startTime + "ms")
    let timeout = Date.parse(nextTime.toUTCString())-Date.now()
    if (timeout <= 0) {
        timeout = 0
    }

    setTimeout(function () {
        update()
    }, timeout)
}
