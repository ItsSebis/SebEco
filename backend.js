// data vars
const fs = require('fs');
const bcrypt = require('bcrypt');

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
let users = {}
let passwords = {}
const skel = {
    balance: 1000,
    inventory: {
        apple: 10,
        apple_crate: 10
    },
}
const socketUser = {}
const userSocket = {}

// read data from file
fs.readFile('./data.json', 'utf8', (err, data) => {
    if (!err) {
        users = JSON.parse(data).users
        passwords = JSON.parse(data).passwords
        console.log("Loaded data!");
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

    socket.on('disconnect', (reason) => {
        if (userSocket[socketUser[socket.id]] === socket.id) {
            delete userSocket[socketUser[socket.id]]
        }
        delete socketUser[socket.id]
    })
})

// functions
// set password for user
function setPassword(user, password) {
    bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash(password, salt, function(err, hash) {
            // Store hash in your password DB.
            if (err) throw err;
            passwords[user] = hash
            console.log(hash + " << " + password)
            console.log(users)
            saveData()
        });
    });
}

// write data to file
function saveData() {
    io.to('authenticated').emit('update', {users: users})
    const data = {
        users: users,
        passwords: passwords,
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