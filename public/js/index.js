// noinspection JSUnresolvedReference
const socket = io()

// user data
let me = ""
let users = {}

// login btn function
document.getElementById("loginBtn").onclick = function () {
    socket.emit('auth', {user: document.getElementById('username').value, password: document.getElementById('password').value})
}

// logged in
socket.on('login', (username) => {
    me = username
    document.getElementsByClassName('login')[0].remove()
    document.getElementById('postLogin').style.display = 'unset'
})
// login failed
socket.on('lError', (err) => {
    document.getElementById('loginError').innerText = err
})

// update
socket.on('update', (backendData) => {
    users = backendData.users
    document.getElementById('displayName').innerText = users[me].displayName
    document.getElementById('balance').innerText = users[me].balance
})