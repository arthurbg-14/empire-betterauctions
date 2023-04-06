const socket = io()
var sortingOrder = 1
var itemFilters = []
var items = []
var balance = 0

function sortItems() {
	const itemDivs = document.querySelectorAll('.item-div');
	const itemDivsArray = Array.from(itemDivs);

	itemDivsArray.sort((a, b) => {
		if (a.item.market_value > b.item.market_value) {
			value = -1
		} else if (a.item.market_value < b.item.market_value) {
			value = 1
		} else {
			value = 0
		}

		return value * sortingOrder
	});

	itemDivsArray.forEach(itemDiv => {
		itemDiv.parentElement.appendChild(itemDiv);
	});

}
function applyFilters() {
	const item_container = document.getElementById("item_container")
	let itemDivsArray = Array.from(document.querySelectorAll('.item-div'))

	itemFilters.forEach((item_filter) => {
		itemDivsArray = itemDivsArray.filter(item_filter)
	})

	item_container.innerHTML = ""
	itemDivsArray.forEach(itemDiv => {
		item_container.appendChild(itemDiv);
	});
}
function renderAllItems() {
	const item_container = document.getElementById("item_container")

	item_container.innerHTML = ""

	items.forEach((item) => renderItem(item))
}
function updateItems() {
	renderAllItems()
	sortItems()
	applyFilters()
}
function renderItem(item) {
	const item_div = document.createElement("div")
	const item_information = document.createElement("div")
	const item_image = document.createElement("img")
	const item_container = document.getElementById("item_container")
	const item_footer = document.createElement("div")
	const buy_button = document.createElement("button")

	item_div.classList.add("item-div")
	item_information.classList.add("item-inf")
	item_footer.classList.add("item-foot")
	buy_button.classList.add("buy-button")

	item_image.src = 'https://community.cloudflare.steamstatic.com/economy/image/' + item.icon_url

	item_div.item = item
	item_information.innerHTML += `<span style='color: ${item.name_color};font-size: 12px'>${item.market_name}</span>`
	buy_button.innerHTML = "Buy"
	buy_button.onclick = (event) => { socket.emit("buy", event.target.parentElement.parentElement.parentElement) }

	if (item.border_color) {
		item_div.style.border = "4px solid " + item.border_color
	}
	if (item.auction_highest_bid) {
		item_footer.innerHTML += `<br><span style="float: left">${item.auction_highest_bid / 100}</span>`
		item_div.value = item.auction_highest_bid
	}
	else {
		item_footer.innerHTML += `<br><span style="float: left">${item.market_value / 100}</span>`
		item_div.value = item.market_value
	}

	item_footer.innerHTML += `<span style="float: right">${item.above_recommended_price}%</span>`

	item_footer.appendChild(buy_button)
	item_information.appendChild(item_footer)
	item_div.appendChild(item_image)
	item_div.appendChild(item_information)
	item_container.appendChild(item_div)
}

socket.on('connect', () => {
	console.log('Connected to server')
})
socket.on('disconnect', () => {
	console.log('Disconnected from server')
})
socket.on("new_item", (data) => {
	data.forEach(item => {
		items.push(item)
	})
	updateItems()
})
socket.on("auction_update", (data) => {
	data.forEach(item_update => {
		items.forEach((item, index) => {
			if (item.id == item_update.id) {
				items[index].above_recommended_price = item_update.above_recommended_price
				items[index].auction_highest_bid = item_update.auction_highest_bid
				items[index].auction_ends_at = item.auction_ends_at
			}
		})
	})
})
socket.on("active_auctions", (active_auctions) => {
	active_auctions.forEach((auction) => {
		items.forEach((item, index) => {
			if (item.id == auction.id) {
				items[index].border_color = "green"
			}
		})
	})
})
socket.on("deleted_item", (data) => {
	items = items.filter((item) => !data.includes(item.id))
	updateItems()
})
socket.on("log", (data) => console.log(data))
socket.on("update_balance", (new_value) => {
	balance = new_value
})

const statTrakCheckbox = document.getElementById("statTrakCheckbox")
function statTrakFilter(item_div) {
	if (item_div.item.market_name.includes("StatTrak")) {
		return false
	}
	return true
}
statTrakCheckbox.addEventListener("change", function () {
	if (this.checked) {
		itemFilters = itemFilters.filter((filter) => filter != statTrakFilter)
	} else {
		itemFilters.push(statTrakFilter)
	}
	updateItems()
})

const uniqueCheckbox = document.getElementById("uniqueCheckbox")
function uniqueFilter(item_div) {
	var same_name_items = []

	items.forEach((item) => {
		if (item.market_name == item_div.item.market_name) {
			if (item.auction_highest_bid) {
				item.value = item.auction_highest_bid
			}
			else {
				item.value = item.market_value
			}
			same_name_items.push(item)
		}
	})

	const lowestValueItem = same_name_items.reduce((anterior, atual) => {
		return anterior.value < atual.value ? anterior : atual;
	});

	if ((item_div.item == lowestValueItem)) {
		return true
	}
	return false
}
uniqueCheckbox.addEventListener("change", function () {
	if (this.checked) {
		itemFilters.push(uniqueFilter)
	} else {
		itemFilters = itemFilters.filter((filter) => filter != uniqueFilter)
	}
	updateItems()
})

const searchBar = document.getElementById("searchBar")
function searchFilter(item_div) {
	const searchBar = document.getElementById("searchBar")

	if (item_div.item.market_name.toLowerCase().includes(searchBar.value.toLowerCase())) {
		return true
	}
	return false
}
searchBar.addEventListener("change", function () {
	if (this.value) {
		if (!itemFilters.includes(searchFilter)) {
			itemFilters.push(searchFilter)
		}
	}
	else {
		itemFilters = itemFilters.filter((filter) => filter != searchFilter)
	}
	updateItems()
})

const onlyPurchasable = document.getElementById("onlyPurchasable")
function onlyPurchasableFilter(item_div) {
	if (item_div.value >= balance) {
		return false
	}
	else {
		return true
	}
}
onlyPurchasable.addEventListener("change", function () {
	if (this.checked) {
		itemFilters.push(onlyPurchasableFilter)
	} else {
		itemFilters = itemFilters.filter((filter) => filter != onlyPurchasableFilter)
	}
	updateItems()
})

const priceAbove = document.getElementById("priceAbove")
function priceAboveFilter(item_div) {
	const priceAbove = document.getElementById("priceAbove")

	if (item_div.item.above_recommended_price <= priceAbove.value) {
		return true
	}
	return false
}
priceAbove.addEventListener("change", function () {
	if (this.value) {
		if (!itemFilters.includes(priceAboveFilter)) {
			itemFilters.push(priceAboveFilter)
		}
	}
	else {
		itemFilters = itemFilters.filter((filter) => filter != priceAboveFilter)
	}
	updateItems()
})