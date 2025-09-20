document.addEventListener('DOMContentLoaded', () => {
  fetch('/get-user')
    .then(res => res.json())
    .then(user => {
      const avatarImg = document.getElementById('avatar');
      const usernameSpan = document.getElementById('username');
      if (user) {
        avatarImg.src = user.avatar || ''; // Set avatar URL or clear if null
        usernameSpan.textContent = user.username || 'Unknown User'; // Set username or fallback
        avatarImg.alt = `Profile picture for ${user.username || 'Unknown User'}`; // Update alt text
      } else {
        avatarImg.src = '';
        usernameSpan.textContent = 'Not Logged In';
        avatarImg.alt = 'No profile picture';
      }
    })
    .catch(error => {
      console.error('Error fetching user data:', error);
      document.getElementById('avatar').src = '';
      document.getElementById('username').textContent = 'Error Loading';
    });
});