// noinspection JSUnresolvedReference
const socket = io()

// user data
let me = ""
let users = {}
const itemNames = {
    apple: "Apfel",
    apple_crate: "Apfelkiste",
    crate: "Kiste",
}

// login btn function
document.getElementById("loginBtn").onclick = function () {
    socket.emit('auth', {user: document.getElementById('username').value, password: document.getElementById('password').value})
}

// logged in
socket.on('login', (username) => {
    me = username
    document.getElementsByClassName('login')[0].remove()
    document.getElementById('postLogin').style.display = 'unset'
    // sebi -> admin
    if (me === "sebi") {
        document.getElementById('adminTab').removeAttribute('style')
    }
})
// login failed
socket.on('lError', (err) => {
    document.getElementById('loginError').innerText = err
})

// password change failed
socket.on('pwChF', (reason) => {
    document.getElementById('pwError').innerText = reason
})
// password change success
socket.on('pwChS', () => {
    document.getElementById('pwError').innerText = ""
    document.getElementById('oldPw').value = ""
    document.getElementById('newPw').value = ""
    document.getElementById('repPw').value = ""
})

// update
socket.on('update', (backendData) => {
    users = backendData.users
    document.getElementById('displayName').innerText = users[me].username
    document.getElementById('balance').innerHTML = "<i class='bx bxs-dollar-circle' ></i> " + users[me].balance
    for (const uid in users) {
        const row = document.createElement("tr")
        const nameCol = document.createElement("td")
        const resetCol = document.createElement("td")
        nameCol.innerText = uid
        resetCol.innerHTML = "<i class='bx bx-reset' ></i>"
        row.appendChild(nameCol)
        row.appendChild(resetCol)
        document.getElementById('usersBody').appendChild(row)
    }
})

// kick
socket.on('kick', () => {
    window.location.reload()
})

// menu btn
document.getElementById('menuBtn').onclick = function () {
    document.getElementById('menu').classList.toggle('active')
}

// menu tab buttons
for (const tabBtn of document.getElementsByClassName('tabBtn')) {
    tabBtn.onclick = function () {
        for (const wrapper of document.getElementsByClassName("mainWrapper")) {
            if (wrapper.classList.contains('active')) {
                wrapper.classList.remove('active')
            }
        }
        document.getElementById(tabBtn.getAttribute('data-value')+'Wrapper').classList.add('active')
        document.getElementById('menu').classList.remove('active')
    }
}

// set password
document.getElementById('setPw').onclick = function () {
    if (document.getElementById('oldPw').value === "" || document.getElementById('newPw').value === ""
        || document.getElementById('repPw').value === "") {
        return
    }
    if (document.getElementById('newPw').value !== document.getElementById('repPw').value) {
        document.getElementById('pwError').innerText = "Die Passwörter stimmen nicht überein!"
        return;
    }
    socket.emit('pw', {old: document.getElementById('oldPw').value, new: document.getElementById('newPw').value})
}
