/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const price = Number(purchase.sale_price) || 0;
    const quantity = Number(purchase.quantity) || 0;
    const discount = Number(purchase.discount) || 0;

    const revenue = price * quantity * (1 - discount / 100);
    return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    if (index === 0) {
        return seller.profit * 0.15;
    } else if (index === 1 || index === 2) {
        return seller.profit * 0.10;
    } else if (index === total - 1) {
        return 0;
    } else {
        return seller.profit * 0.05;
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // Проверка входных данных
    if (!data || !Array.isArray(data.sellers) || !Array.isArray(data.products) || !Array.isArray(data.purchase_records)) {
        throw new Error("Некорректные входные данные");
    }

    // Проверка опций
    if (!options || typeof options.calculateRevenue !== "function" || typeof options.calculateBonus !== "function") {
        throw new Error("Не переданы функции расчета");
    }

    // Подготовка статистики по продавцам
    const sellersStats = data.sellers.map(seller => ({
        seller_id: seller.id,
        name: seller.first_name + " " + seller.last_name,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    const sellersIndex = {};
    sellersStats.forEach(s => sellersIndex[s.seller_id] = s);

    const productsIndex = {};
    data.products.forEach(p => productsIndex[p.sku] = p);

    // Подсчет выручки и прибыли
    data.purchase_records.forEach(record => {
        const seller = sellersIndex[record.seller_id];
        if (!seller) return;

        seller.sales_count += 1;

        let totalRevenue = 0;

        (record.items || []).forEach(item => {
            const product = productsIndex[item.sku];
            const itemRevenue = options.calculateRevenue(item, product);
            totalRevenue += itemRevenue;

            const cost = (product ? product.purchase_price : 0) * item.quantity;
            seller.profit += itemRevenue - cost;

            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });

        if (record.total_amount !== undefined) {
            seller.revenue += record.total_amount;
        } else {
            seller.revenue += totalRevenue;
        }
    });

    // Сортировка продавцов по прибыли
    sellersStats.sort((a, b) => b.profit - a.profit);

    // Назначение бонусов и топ-товаров
    sellersStats.forEach((seller, index) => {
        seller.bonus = +options.calculateBonus(index, sellersStats.length, seller).toFixed(2);

        const top = Object.entries(seller.products_sold).map(([sku, quantity]) => ({
            sku,
            quantity
        })).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

        seller.top_products = top;

        seller.revenue = +seller.revenue.toFixed(2);
        seller.profit = +seller.profit.toFixed(2);
    });

    return sellersStats.map(s => ({
        seller_id: s.seller_id,
        name: s.name,
        revenue: s.revenue,
        profit: s.profit,
        sales_count: s.sales_count,
        top_products: s.top_products,
        bonus: s.bonus
    }));
}

// Экспорт для автотестов
if (typeof module !== "undefined" && module.exports) {
    module.exports = { calculateSimpleRevenue, calculateBonusByProfit, analyzeSalesData };
}
