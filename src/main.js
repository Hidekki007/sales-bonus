/**
 * Функция для расчета выручки
 * @param purchase запись о покупке (например: { sale_price, quantity, discount, sku })
 * @param _product карточка товара (необязательна)
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const sale_price = Number(purchase.sale_price) || 0;
    const quantity = Number(purchase.quantity) || 0;
    const discount = Number(purchase.discount) || 0; // проценты

    const factor = 1 - discount / 100;
    return sale_price * quantity * factor;
}

/**
 * Функция для расчета бонусов
 * Методика:
 *  - 15% для первого места
 *  - 10% для второго и третьего
 *  - 5% для всех остальных, кроме последнего
 *  - 0% для последнего
 *
 * @param index индекс в отсортированном по прибыли массиве (0 = лучший)
 * @param total общее число продавцов
 * @param seller объект продавца (с полем profit)
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    if (index === 0) return seller.profit * 0.15;
    if (index === 1 || index === 2) return seller.profit * 0.10;
    if (index === total - 1) return 0;
    return seller.profit * 0.05;
}

/**
 * Главная функция анализа
 * @param data { sellers, products, purchase_records }
 * @param options { calculateRevenue, calculateBonus }
 * @returns {Array} массив итоговых объектов в формате, ожидаемом автотестами
 */
function analyzeSalesData(data, options) {
    // --- Проверки входных данных ---
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
        throw new Error("Не переданы функции расчёта");
    }

    const { calculateRevenue, calculateBonus } = options;
    if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
        throw new Error("Не переданы функции расчёта");
    }

    // --- Подготовка промежуточных структур ---
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id, // seller.id ожидается в датасетах
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    const sellerIndex = Object.fromEntries(sellerStats.map(s => [s.id, s]));
    const productIndex = Object.fromEntries((data.products || []).map(p => [p.sku, p]));

    // --- Обход чеков и подсчёт ---
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return; // если в данных встречается неизвестный seller_id — пропускаем

        seller.sales_count += 1;

        // Выручка: если в чеке есть total_amount — используем его, иначе суммируем позиции
        let recordRevenue = 0;
        if (record.total_amount !== undefined && !isNaN(Number(record.total_amount))) {
            recordRevenue = Number(record.total_amount);
        } else {
            recordRevenue = (record.items || []).reduce((sum, item) => {
                return sum + Number(calculateRevenue(item, productIndex[item.sku]));
            }, 0);
        }
        seller.revenue += recordRevenue;

        // По каждой позиции считаем прибыль и количество проданных штук
        (record.items || []).forEach(item => {
            const product = productIndex[item.sku] || {};
            const purchasePrice = Number(product.purchase_price) || 0; // себестоимость за единицу
            const qty = Number(item.quantity) || 0;

            const revenue = Number(calculateRevenue(item, product));
            const cost = purchasePrice * qty;
            const profit = revenue - cost;

            seller.profit += profit;

            if (!seller.products_sold[item.sku]) seller.products_sold[item.sku] = 0;
            seller.products_sold[item.sku] += qty;
        });
    });

    // --- Сортировка по прибыли (убывание) ---
    sellerStats.sort((a, b) => b.profit - a.profit);

    // --- Назначение бонусов и подготовка топ-10 товаров ---
    sellerStats.forEach((seller, index) => {
        // бонус округляем до 2 знаков (как требуют тесты)
        seller.bonus = +calculateBonus(index, sellerStats.length, seller).toFixed(2);

        seller.top_products = Object.entries(seller.products_sold || {})
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

        // округляем revenue и profit до 2 знаков для финального вывода
        seller.revenue = +seller.revenue.toFixed(2);
        seller.profit = +seller.profit.toFixed(2);
    });

    // --- Формирование итогового массива ---
    return sellerStats.map(s => ({
        seller_id: s.id,
        name: s.name,
        revenue: s.revenue,
        profit: s.profit,
        sales_count: s.sales_count,
        top_products: s.top_products,
        bonus: s.bonus
    }));
}

// Экспорт для автотестов (Node)
if (typeof module !== "undefined" && module.exports) {
    module.exports = { calculateSimpleRevenue, calculateBonusByProfit, analyzeSalesData };
}
