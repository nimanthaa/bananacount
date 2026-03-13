/**
 * Banana API Manager
 * Responsible for fetching puzzles and solutions.
 */

const API_URL = 'https://marcconrad.com/uob/banana/api.php';

export const fetchPuzzle = async () => {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Failed to fetch puzzle');
        const data = await response.json();
        return data; // { question: url, solution: number }
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
};
