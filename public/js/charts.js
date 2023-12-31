let currentItem = "apple"

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

socket.on('updateStats', (backendStats) => {
    // main loop
    console.log(backendStats)
    const rawStats = {}

    for (const iid of backendStats.allItems) {
        let avgPriceStr = ""
        if (backendStats.arch.currentAvg[iid] !== undefined) {
            avgPriceStr = " ($" + (Math.round(backendStats.arch.currentAvg[iid]*100)/100) + ")"
        }
        if (document.getElementById('option'+iid) === null) {
            const itemOption = document.createElement('option')
            itemOption.id = 'option'+iid
            itemOption.value = iid
            itemOption.innerText = itemNames[iid] + avgPriceStr
            document.getElementById('selectItem').appendChild(itemOption)
        } else {
            document.getElementById('option'+iid).innerText = itemNames[iid] + avgPriceStr
        }
    }

    // all archived stats
    if (backendStats.arch.items !== undefined) {
        for (const dateNum in backendStats.arch.items) {

            const date = new Date(parseInt(dateNum))
            const thisData = backendStats.arch.items[dateNum]
            const dateString = date.getDate().toString() + "." + (date.getMonth()+1).toString() + "." + date.getFullYear().toString()

            if (rawStats[dateString] === undefined) {
                rawStats[dateString] = {items: thisData}
            } else {
                const currentData = rawStats[dateString].items
                const merged = {}

                for (const item in currentData) {
                    merged[item] = currentData[item]
                }
                for (const item in thisData) {
                    merged[item] = {}

                    for (const price in currentData[item]) {
                        merged[item][price] = currentData[item][price]
                    }
                    for (const price in thisData[item]) {
                        if (currentData[item] !== undefined && currentData[item][price] !== undefined) {
                            merged[item][price] = thisData[item][price] + currentData[item][price]
                        } else {
                            merged[item][price] = thisData[item][price]
                        }
                    }
                }
                rawStats[dateString].items = merged
            }

            // let tradeCount = 0
            // for (const iid in rawStats[dateString].items) {
            //     for (const price in rawStats[dateString].items[iid]) {
            //         tradeCount += rawStats[dateString].items[iid][price]
            //     }
            // }

            //rawStats[dateString].tradeCount = tradeCount
        }
    }

    if (backendStats.cur.items !== undefined) {
        rawStats["Heute"] = {items: backendStats.cur.items}
    }

    console.log(rawStats)

    const completeStats = {}

    let average = []
    let highArray = []
    let lowArray = []
    let dates = []

    for (const dateString in rawStats) {
        completeStats[dateString] = {}

        for (const iid in rawStats[dateString].items) {
            let high = 0
            let low = Infinity
            let sales = 0
            let totalVolume = 0

            for (const price in rawStats[dateString].items[iid]) {
                const priceNum = Number(price)
                if (high < priceNum) {
                    high = priceNum
                }
                if (low > priceNum) {
                    low = priceNum
                }
                sales += rawStats[dateString].items[iid][price]
                totalVolume += rawStats[dateString].items[iid][price] * price
            }

            completeStats[dateString][iid] = {avg: (totalVolume/sales), high: high, low: low}
            if (iid === currentItem) {
                average.push(totalVolume / sales)
                highArray.push(high)
                lowArray.push(low)
                dates.push(dateString + " (" + sales + ")")
            }
        }
    }

    console.log(completeStats)

    const data = {
        labels: dates,
        datasets: [{
            label: 'Average',
            data: average,
            fill: false,
            borderColor: 'rgb(51,128,38)'
        },{
            label: 'High',
            data: highArray,
            fill: false,
            borderColor: 'rgb(255,31,31)'
        },{
            label: 'Low',
            data: lowArray,
            fill: true,
            borderColor: 'rgb(0,58,255)'
        }
        ]
    };

    const config = {
        type: 'line',
        data: data,
        options: {
            animation: false
        }
    };

    update(config)

})