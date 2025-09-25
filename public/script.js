document.addEventListener('DOMContentLoaded', () => {
  console.log('=== Frontend: Loading user data ===');
  
  // Check if we have OAuth parameters in the URL
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  
  console.log('URL search params:', Object.fromEntries(urlParams));
  console.log('URL hash params:', Object.fromEntries(hashParams));
  
  // If we have OAuth parameters, try to handle them
  if (urlParams.get('access_token') || hashParams.get('access_token')) {
    console.log('OAuth parameters detected, redirecting to callback handler');
    const accessToken = urlParams.get('access_token') || hashParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token');
    
    // Redirect to callback handler with parameters
    const callbackUrl = '/auth/callback?' + 
      (accessToken ? `access_token=${accessToken}` : '') +
      (refreshToken ? `&refresh_token=${refreshToken}` : '');
    
    window.location.href = callbackUrl;
    return;
  }
  
  fetch('/get-user')
    .then(res => {
      console.log('Response status:', res.status);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(user => {
      console.log('Received user data:', user);
      console.log('User object keys:', user ? Object.keys(user) : 'null');
      console.log('User username:', user?.username);
      console.log('User avatar:', user?.avatar);
      console.log('User discord_id:', user?.discord_id);
      
      // Header elements
      const headerAvatarImg = document.getElementById('avatar');
      const headerUsernameSpan = document.getElementById('username');
      const userIdSpan = document.getElementById('user-id');
      
      // Profile section elements
      const profileAvatarImg = document.getElementById('profile-avatar');
      const profileUsernameH3 = document.getElementById('profile-username');
      const profileIdP = document.getElementById('profile-id');
      
      console.log('Found elements:', {
        headerAvatarImg: !!headerAvatarImg,
        headerUsernameSpan: !!headerUsernameSpan,
        userIdSpan: !!userIdSpan,
        profileAvatarImg: !!profileAvatarImg,
        profileUsernameH3: !!profileUsernameH3,
        profileIdP: !!profileIdP
      });
      
      if (user && user.username) {
        console.log('Setting username:', user.username);
        console.log('Setting avatar:', user.avatar);
        console.log('Setting user ID:', user.discord_id);
        
        // Set header username and ID
        headerUsernameSpan.textContent = user.username;
        if (user.discord_id) {
          userIdSpan.textContent = `ID: ${user.discord_id}`;
        }
        
        // Set profile section username and ID
        profileUsernameH3.textContent = user.username;
        if (user.discord_id) {
          profileIdP.textContent = `Discord ID: ${user.discord_id}`;
        }
        
        // Set avatars with fallback
        const avatarUrl = user.avatar && user.avatar.trim() !== '' 
          ? user.avatar 
          : 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        // Header avatar
        headerAvatarImg.src = avatarUrl;
        headerAvatarImg.alt = `Profile picture for ${user.username}`;
        headerAvatarImg.style.display = 'block';
        
        // Profile section avatar
        profileAvatarImg.src = avatarUrl;
        profileAvatarImg.alt = `Profile picture for ${user.username}`;
        profileAvatarImg.style.display = 'block';
        
      } else {
        console.log('No user data or username found');
        // User not logged in
        headerAvatarImg.src = '';
        headerAvatarImg.style.display = 'none';
        headerUsernameSpan.textContent = 'Not logged in';
        userIdSpan.textContent = '';
        
        profileAvatarImg.src = '';
        profileAvatarImg.style.display = 'none';
        profileUsernameH3.textContent = 'Not logged in';
        profileIdP.textContent = '';
      }
    })
    .catch(error => {
      console.error('Error fetching user data:', error);
      
      // Header elements
      const headerAvatarImg = document.getElementById('avatar');
      const headerUsernameSpan = document.getElementById('username');
      const userIdSpan = document.getElementById('user-id');
      
      // Profile section elements
      const profileAvatarImg = document.getElementById('profile-avatar');
      const profileUsernameH3 = document.getElementById('profile-username');
      const profileIdP = document.getElementById('profile-id');
      
      headerAvatarImg.src = '';
      headerAvatarImg.style.display = 'none';
      headerUsernameSpan.textContent = 'Error loading user data';
      userIdSpan.textContent = '';
      
      profileAvatarImg.src = '';
      profileAvatarImg.style.display = 'none';
      profileUsernameH3.textContent = 'Error loading user data';
      profileIdP.textContent = '';
    });
});