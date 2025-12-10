// Find the span by ID
const mySpan = document.getElementById('myspan');

// Add click event listener
mySpan.addEventListener('click', () => {
    mySpan.textContent = 'It worked!';
});