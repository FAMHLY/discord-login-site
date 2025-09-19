document.addEventListener('DOMContentLoaded', () => {
  fetch('/get-user')
    .then(res => res.json())
    .then(user => {
      if (user) {
        document.getElementById('username').textContent = user.username;
        document.getElementById('avatar').src = user.avatar;
      }
    })
    .catch(() => console.error('Error fetching user'));
});