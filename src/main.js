/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    // выручка = количество * цена со скидкой (если есть)
    const discount = purchase.discount ?? 0; // скидка в %
    const priceWithDiscount = _product.price * (1 - discount / 100);
    return purchase.quantity * priceWithDiscount;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // простой алгоритм: чем выше место в рейтинге, тем больше бонус
    // первый получает 100%, последний — 0%
    const rank = (total - index) / total; 
    return Math.round(seller.profit * 0.1 * rank); // бонус 10% от прибыли, уменьшается по позиции
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // --- Проверка входных данных ---
    if (!data || typeof data !== "object") {
        throw new Error("Некорректные входные данные");
    }

    if (!data.sellers || !Array.isArray(data.sellers) || data.sellers.length === 0) {
        throw new Error("Нет данных о продавцах");
    }

    if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
        throw new Error("Нет данных о товарах");
    }

    if (!data.purchase_records || !Array.isArray(data.purchase_records) || data.purchase_records.length === 0) {
        throw new Error("Нет данных о покупках");
    }

    if (!options || typeof options !== "object") {
        throw new Error("Некорректные опции");
    }

    // --- Подготовка промежуточных структур ---
    const sellersIndex = {};
    const productsIndex = {};

    // Индексация продавцов
    data.sellers.forEach(seller => {
        sellersIndex[seller.seller_id] = {
            ...seller,
            sales_count: 0,
            revenue: 0,
            profit: 0,
            top_products: []
        };
    });

    // Индексация товаров
    data.products.forEach(product => {
        productsIndex[product.product_id] = product;
    });

    // --- Расчет выручки и прибыли ---
    data.purchase_records.forEach(record => {
        const seller = sellersIndex[record.seller_id];
        const product = productsIndex[record.product_id];

        if (seller && product) {
            const revenue = options.calculateRevenue(record, product);
            seller.revenue += revenue;
            seller.sales_count += record.quantity;
            seller.profit += revenue - product.prime_cost * record.quantity;
            seller.top_products.push(product.name);
        }
    });

    // --- Сортировка продавцов по прибыли ---
    const sellers = Object.values(sellersIndex);
    sellers.sort((a, b) => b.profit - a.profit);

    // --- Назначение бонусов ---
    sellers.forEach((seller, index) => {
        seller.bonus = options.calculateBonus(index, sellers.length, seller);
    });

    // --- Подготовка итоговой коллекции ---
    return sellers.map(seller => ({
        seller_id: seller.seller_id,
        name: seller.name,
        sales_count: seller.sales_count,
        revenue: seller.revenue,
        profit: seller.profit,
        top_products: seller.top_products,
        bonus: seller.bonus
    }));
}

// экспортируем функции (если нужно для тестов)
if (typeof module !== "undefined") {
    module.exports = { calculateSimpleRevenue, calculateBonusByProfit, analyzeSalesData };
}
