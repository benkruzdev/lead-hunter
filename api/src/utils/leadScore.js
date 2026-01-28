/**
 * Calculate lead score based on rating and reviews count
 * @param {number} rating - Business rating (0-5)
 * @param {number} reviews_count - Number of reviews
 * @returns {'hot' | 'warm' | 'cold'} Score category
 */
export function calculateLeadScore(rating, reviews_count) {
    if (!rating || !reviews_count) {
        return 'cold';
    }

    if (rating >= 4.5 && reviews_count >= 200) {
        return 'hot';
    }

    if (rating >= 4.0 && reviews_count >= 50) {
        return 'warm';
    }

    return 'cold';
}
