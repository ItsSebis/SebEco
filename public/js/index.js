// noinspection JSUnresolvedReference
const socket = io()

// user data
let me = ""
let users = {}
let online = []
const fungible = ["apple", "banana", "carrots", "dattel", "strawberry", "grapefruit", "orange", "mango", "metal", "wood"]
const itemNames = {
    apple: "Apfelkiste",
    banana: "Bananen",
    carrots: "Karotten",
    dattel: "Dattel",
    strawberry: "Erdbeere",
    grapefruit: "Grapefruit",
    orange: "Orange",
    mango: "Mango",

    metal: "Metall",
    wood: "Holz",

    diamond: "Diamant"
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

// log from server
socket.on('log', (text) => {
    console.log(text)
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

// failure while buying on great market
socket.on('greatFail', (err) => {
    alert(err)
})

// update
socket.on('update', (backendData) => {
    users = backendData.users
    document.getElementById('displayName').innerText = me
    document.getElementById('greatSpecial').innerText = itemNames[users[me].special]
    document.getElementById('greatSpecialSelect').value = users[me].newSpecial
    document.getElementById('greatPrice').innerText = "$"+users[me].todayPrice+"/stk"

    let nWUser = null
    for (const uid in users) {
        if (nWUser === null) {
            nWUser = uid
        } else if (users[uid].balance > users[nWUser].balance) {
            nWUser = uid
        }
    }
    document.getElementById('mostNetWorthUser').innerText = nWUser + " ($" + (Math.round(users[nWUser].balance*100)/100) + ")"

    let profitUser = null
    for (const uid in users) {
        if (profitUser === null || users[profitUser].stats === undefined || users[profitUser].stats.profit === undefined) {
            profitUser = uid
        } else if (users[uid].stats !== undefined && users[uid].stats.profit !== undefined && users[uid].stats.profit > users[profitUser].stats.profit) {
            profitUser = uid
        }
    }
    if (users[profitUser].stats !== undefined && users[profitUser].stats.profit !== undefined) {
        document.getElementById('allTimeMostProfit').innerText = profitUser + " ($" + (Math.round(users[profitUser].stats.profit * 100) / 100) + ")"
    } else {
        document.getElementById('allTimeMostProfit').innerText = "Niemand hat bisher etwas verkauft!"
    }

    document.getElementById('moneyVolume').innerText = "$" + Math.round(backendData.volumes.money*100)/100
    document.getElementById('itemVolume').innerText = "$" + Math.round(backendData.volumes.items*100)/100

    if (users[me].greatStop) {
        document.getElementById('greatSubmit').innerHTML = "<b>Heute keine Waren verfügbar!</b>"
    } else if (users[me].greatBuy) {
        document.getElementById('greatSubmit').innerHTML = "<b>Bereits eingekauft!</b>"
    } else {
        let quantity = document.getElementById("greatQuantity").value
        quantity = Math.round(quantity)
        const pricePP = users[me].todayPrice
        document.getElementById('greatLivePrice').innerText = "$" + (Math.round(quantity*pricePP*100)/100)
    }

    if (users[me].motd !== undefined) {
        document.getElementById('motd').innerHTML = users[me].motd
    } else {
        document.getElementById('motd').innerHTML = ""
    }

    if (users[me].invLvl !== undefined) {
        document.getElementById('invLevelScreen').innerHTML = "Level: " + users[me].invLvl + "<br>" +
            "Plätze: " + invLevels[users[me].invLvl].stacks + "<br>Platzgröße: " + invLevels[users[me].invLvl].stackSize
        if (document.getElementById('upgradeInv') !== null) {
            document.getElementById('upgradeInv').innerText = "Upgrade " +
                "(" + invLevels[users[me].invLvl+1].metal + "M & " + invLevels[users[me].invLvl+1].wood + "W)"
        }
        if (users[me].invLvl+1 > Object.keys(invLevels)) {
            document.getElementById('upgradeInv').remove()
        }
    } else {
        document.getElementById('invLevelScreen').innerHTML = "Level: 1<br>" +
            "Plätze: " + invLevels[1].stacks + "<br>Platzgröße: " + invLevels[1].stackSize
        document.getElementById('upgradeInv').innerText = "Upgrade " +
            "(" + invLevels[2].metal + "M & " + invLevels[2].wood + "W)"
    }

    if (users[me].storageBroke !== undefined) {
        document.getElementById('storageBroken').classList.add('active')
        document.getElementById('repairCost').innerText =
            "Metall: " + users[me].storageBroke.metal +
            ", Holz: " + users[me].storageBroke.wood
    } else {
        document.getElementById('storageBroken').classList.remove('active')
    }

    if (backendData.diamond === true) {
        document.getElementById("diamondSpawner").classList.add("active")
    } else {
        document.getElementById("diamondSpawner").classList.remove("active")
    }

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
        console.log(count)
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
            if (users[me].offers[item] !== undefined) {
                offerCol.style.color = "lime"
                offerCol.innerHTML = "$" + users[me].offers[item]
            } else {
                offerCol.style.color = "red"
                offerCol.innerHTML = "<i class='bx bxs-store' ></i>"
            }
            offerCol.id = "offer" + me + item
            offerCol.classList.add("colBtn")
            offerCol.onclick = function () {
                if (users[me].offers === undefined || users[me].offers[item] === undefined) {
                    // set price
                    let inputPrice = prompt("Was verlangen Sie für ihr Produkt '" + itemNames[item] + "'?")
                    if (inputPrice === null) {
                        return
                    }
                    while (!inputPrice.match(/^[+-]?([0-9]*[.])?[0-9]+$/)) {
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
            const offerCol = document.getElementById('show'+item).getElementsByTagName('td')[2]
            if (users[me].offers[item] !== undefined) {
                offerCol.style.color = "lime"
                offerCol.innerHTML = "$" + users[me].offers[item]
            } else {
                offerCol.style.color = "red"
                offerCol.innerHTML = "<i class='bx bxs-store' ></i>"
            }
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
    let quantity = document.getElementById("greatQuantity").value
    if (quantity === undefined || quantity === null) {
        return
    }

    quantity = Math.round(quantity)
    if (quantity <= 0) {
        alert("Du musst einen Wert über Null eintragen um etwas zu kaufen?!")
        return
    }
    const pricePP = users[me].todayPrice
    if (confirm("Wirklich " + quantity + " Stück von " + itemNames[users[me].special] + " für " + (Math.round(quantity*pricePP*100)/100) + " kaufen?")) {
        socket.emit('buyGreat', quantity)
    }
}
document.getElementById('greatQuantity').oninput = function () {
    let quantity = document.getElementById("greatQuantity").value
    quantity = Math.round(quantity)
    const pricePP = users[me].todayPrice
    document.getElementById('greatLivePrice').innerText = "$" + (Math.round(quantity*pricePP*100)/100)
}

// change great market special
document.getElementById('greatSpecialSelect').onchange = function () {
    const newSpecial = document.getElementById('greatSpecialSelect').value
    socket.emit('changeSpecial', newSpecial)
}

// ADMIN FUNCTIONS
// create user
function createUser() {
    const username = prompt("New username...")

    if (username === "" || username === null || username === undefined) {
        return
    }
    socket.emit('createUser', username)
}
function setAttribute(key, value, user = me) {
    socket.emit('setAttribute', {key: key, value: value, user: user})
}

function repairStorage() {
    if (
        users[me].storageBroke === undefined ||
        users[me].inventory.metal === undefined ||
        users[me].inventory.wood === undefined ||
        users[me].inventory.metal < users[me].storageBroke.metal ||
        users[me].inventory.wood < users[me].storageBroke.wood
    ) {
        alert("Nicht genug Materialien!")
        return
    }
    socket.emit('repairStorage')
}

function upgradeInv() {
    let invLvl = 1
    if (users[me].invLvl !== undefined) {
        invLvl = users[me].invLvl
    }
    if (
        users[me].inventory.metal === undefined ||
        users[me].inventory.wood === undefined ||
        users[me].inventory.metal < invLevels[invLvl].metal ||
        users[me].inventory.wood < invLevels[invLvl].wood
    ) {
        alert("Nicht genug Materialien!")
        return
    }
    socket.emit('upgradeInv')
    console.log('upgrade req sent')
}

// ON LOAD
// focus on login
document.getElementById("username").focus();

// generate selection lead
for (const special of fungible) {
    const newSpecial = document.createElement('option')
    newSpecial.value = special
    newSpecial.innerText = itemNames[special]
    document.getElementById('greatSpecialSelect').appendChild(newSpecial)
}
