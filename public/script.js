document.addEventListener('DOMContentLoaded', () => {
  fetch('/get-user')
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(user => {
      const avatarImg = document.getElementById('avatar');
      const usernameSpan = document.getElementById('username');
      
      if (user && user.username) {
        // Set username
        usernameSpan.textContent = user.username;
        
        // Set avatar with fallback
        if (user.avatar && user.avatar.trim() !== '') {
          avatarImg.src = user.avatar;
          avatarImg.alt = `Profile picture for ${user.username}`;
          avatarImg.style.display = 'block';
        } else {
          // Use default Discord avatar or hide
          avatarImg.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
          avatarImg.alt = 'Default profile picture';
          avatarImg.style.display = 'block';
        }
      } else {
        // User not logged in
        avatarImg.src = '';
        avatarImg.style.display = 'none';
        usernameSpan.textContent = 'Not logged in';
        avatarImg.alt = 'No profile picture';
      }
    })
    .catch(error => {
      console.error('Error fetching user data:', error);
      const avatarImg = document.getElementById('avatar');
      const usernameSpan = document.getElementById('username');
      
      avatarImg.src = '';
      avatarImg.style.display = 'none';
      usernameSpan.textContent = 'Error loading user data';
      avatarImg.alt = 'Error loading profile picture';
    });
});