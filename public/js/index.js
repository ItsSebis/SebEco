// noinspection JSUnresolvedReference
const socket = io()

// user data
let me = ""
let users = {}
let online = []
const itemNames = {
    apple: "Apfelkiste",
    banana: "Bananen",
    carrots: "Karotten"
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

// password reset result
socket.on('resetPwResult', (res) => {
    document.getElementById('resetRes').innerText = res
})

// cannot buy offer
socket.on('cannotBuy', (err) => {
    alert(err)
})

// update
socket.on('update', (backendData) => {
    users = backendData.users
    document.getElementById('displayName').innerText = users[me].username
    document.getElementById('greatSpecial').innerText = itemNames[users[me].special]
    document.getElementById('greatPrice').innerText = "$"+users[me].todayPrice+"/stk"
    document.getElementById('balance').innerHTML = "<i class='bx bxs-dollar-circle' ></i> " + (Math.floor(users[me].balance*100)/100)
    for (const uid in users) {
        if (document.getElementById('manage'+uid) === null && uid !== "sebi") {
            const row = document.createElement("tr")
            const nameCol = document.createElement("td")
            const resetCol = document.createElement("td")
            row.id = "manage" + uid
            row.classList.add("userRow")
            row.setAttribute('data-user', uid)
            nameCol.innerText = uid
            resetCol.innerHTML = "<i class='bx bx-reset' ></i>"
            resetCol.id = "reset" + uid
            resetCol.classList.add("colBtn")
            resetCol.onclick = function () {
                socket.emit('resetPw', (uid))
            }
            row.appendChild(nameCol)
            row.appendChild(resetCol)
            document.getElementById('usersBody').appendChild(row)
        }
    }
    for (let i = 0; i < 3; i++) {
        for (const uRow of document.getElementsByClassName("userRow")) {
            if (users[uRow.getAttribute('data-user')] === undefined) {
                uRow.remove()
            }
        }
    }

    for (const item in users[me].inventory) {
        const count = users[me].inventory[item]
        if (document.getElementById('show'+item) === null) {
            const row = document.createElement("tr")
            const nameCol = document.createElement("td")
            const countCol = document.createElement("td")
            const offerCol = document.createElement("td")
            row.id = "show" + item
            row.classList.add("itemRow")
            row.setAttribute('data-item', item)
            nameCol.innerText = itemNames[item]
            countCol.innerText = count.toString()
            offerCol.innerHTML = "<i class='bx bxs-store' ></i>"
            offerCol.id = "offer" + me + item
            offerCol.classList.add("colBtn")
            offerCol.onclick = function () {
                if (users[me].offers === undefined || users[me].offers[item] === undefined) {
                    // set price
                    let inputPrice = prompt("Was verlangen Sie für ihr Produkt '" + itemNames[item] + "'?")
                    if (inputPrice === null) {
                        return
                    }
                    while (!inputPrice.match(/^[+]?([0-9]*[.])?[0-9]+$/)) {
                        inputPrice = prompt("Geben Sie eine Dezimalzahl als Preis ein z.B. '1.87'!")
                    }
                    const price = parseFloat(inputPrice)

                    socket.emit('offerItem', ({price: price, item: item}))
                } else {
                    if (confirm("Möchten Sie ihr Angebot für " + itemNames[item] + " ($" + users[me].offers[item] + ") vom Markt nehmen?")) {
                        socket.emit('removeOffer', (item))
                        console.log("Offer removed")
                    }
                }
            }
            row.appendChild(nameCol)
            row.appendChild(countCol)
            row.appendChild(offerCol)
            document.getElementById('itemsBody').appendChild(row)
        } else {
            document.getElementById('show'+item).getElementsByTagName('td')[1].innerText = count.toString()
        }
    }
    for (let i = 0; i < 3; i++) {
        for (const iRow of document.getElementsByClassName("itemRow")) {
            if (users[me].inventory[iRow.getAttribute('data-item')] === undefined) {
                iRow.remove()
            } else {
                const item = iRow.getAttribute('data-item')
                iRow.getElementsByTagName('td')[1].innerText = users[me].inventory[item]
            }
        }
    }

    for (const uid in users) {
        if (users[uid].offers === undefined || uid === me) {
            continue
        }
        for (const tid in users[uid].offers) {
            if (document.getElementById('trade' + uid + tid) === null) {
                const row = document.createElement("tr")
                const nameCol = document.createElement("td")
                const priceCol = document.createElement("td")
                const buyCol = document.createElement("td")
                row.id = "trade" + uid + tid
                row.classList.add("tradeRow")
                row.setAttribute('data-trade-uid', uid)
                row.setAttribute('data-trade-item', tid)
                nameCol.innerHTML = itemNames[tid] + "<br>von " + uid
                priceCol.innerText = "$" + users[uid].offers[tid].toString()
                buyCol.innerHTML = "<i class='bx bx-target-lock'></i>"
                buyCol.id = "request" + uid + tid
                buyCol.classList.add("colBtn")
                buyCol.onclick = function () {
                    // request buy
                    socket.emit('buyOffer', {seller: uid, product: tid})
                }
                row.appendChild(nameCol)
                row.appendChild(priceCol)
                row.appendChild(buyCol)
                document.getElementById('tradeBody').appendChild(row)
            }
        }
    }
    for (let i = 0; i < 3; i++) {
        for (const tRow of document.getElementsByClassName("tradeRow")) {
            const seller = tRow.getAttribute('data-trade-uid')
            const item = tRow.getAttribute('data-trade-item')
            if (users[seller].offers[item] === undefined) {
                tRow.remove()
            }
        }
    }
})

// set online users
socket.on('setOnline', (onlineUsers) => {
    online = onlineUsers
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

// great buy
document.getElementById('greatBuyBtn').onclick = function () {

}

// create user
function createUser() {
    const username = prompt("New username...")

    if (username === "" || username === null || username === undefined) {
        return
    }
    socket.emit('createUser', username)
}

// focus on login
document.getElementById("username").focus();