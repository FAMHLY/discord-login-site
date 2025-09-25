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

  // Initialize server management if we're on the dashboard
  if (window.location.pathname.includes('dashboard')) {
    initializeServerManagement();
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

// ===== SERVER MANAGEMENT FUNCTIONS =====

function initializeServerManagement() {
  console.log('Initializing server management...');
  
  // Add event listeners
  const refreshBtn = document.getElementById('refresh-servers');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadServers);
  }
  
  // Load servers on page load
  loadServers();
}

async function loadServers() {
  console.log('Loading servers...');
  const serversList = document.getElementById('servers-list');
  const inviteLinks = document.getElementById('invite-links');
  
  if (!serversList) return;
  
  serversList.innerHTML = '<div class="loading">Loading your servers...</div>';
  
  try {
    const response = await fetch('/api/servers');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const responseData = await response.json();
    console.log('Loaded servers response:', responseData);
    
    // Check if this is the new response format with setup_required
    if (responseData.setup_required) {
      serversList.innerHTML = `
        <div class="error">
          <h4>Discord OAuth Setup Required</h4>
          <p>To automatically fetch your Discord servers, we need to configure additional OAuth permissions.</p>
          <p><strong>Discord User ID:</strong> ${responseData.discord_user_id}</p>
          <p>For now, you can manually add your Discord server by providing the server ID.</p>
          <div style="margin-top: 15px;">
            <input type="text" id="manual-server-id" placeholder="Enter your Discord Server ID" style="padding: 10px; margin-right: 10px; border-radius: 5px; border: 1px solid #ccc;">
            <button class="btn btn-primary" id="add-server-btn">Add Server</button>
          </div>
        </div>
      `;
      
      // Add event listener to the button
      const addServerBtn = document.getElementById('add-server-btn');
      if (addServerBtn) {
        addServerBtn.addEventListener('click', addManualServer);
      }
      
      // Show configured servers if any
      if (responseData.configured_servers && responseData.configured_servers.length > 0) {
        const configuredSection = document.createElement('div');
        configuredSection.innerHTML = `
          <h4>Your Configured Servers</h4>
          ${responseData.configured_servers.map(server => createServerCard({
            id: server.discord_server_id,
            name: server.server_name,
            icon: null,
            owner: true,
            permissions: 0,
            invite_code: server.invite_code,
            is_configured: true,
            created_at: server.created_at
          })).join('')}
        `;
        serversList.appendChild(configuredSection);
      }
      
      return;
    }
    
    // Handle normal server list response
    const servers = Array.isArray(responseData) ? responseData : [];
    
    if (servers.length === 0) {
      serversList.innerHTML = '<div class="error">No Discord servers found. Make sure you have admin permissions on at least one server.</div>';
      return;
    }
    
    // Render servers
    serversList.innerHTML = servers.map(server => createServerCard(server)).join('');
    
    // Add event listeners for server action buttons
    addServerActionListeners();
    
    // Render invite links for configured servers
    const configuredServers = servers.filter(server => server.is_configured);
    if (inviteLinks && configuredServers.length > 0) {
      inviteLinks.innerHTML = configuredServers.map(server => createInviteCard(server)).join('');
      // Add event listeners for invite action buttons
      addInviteActionListeners();
    } else if (inviteLinks) {
      inviteLinks.innerHTML = '<div class="error">No servers configured yet. Configure a server to generate invite links.</div>';
    }
    
  } catch (error) {
    console.error('Error loading servers:', error);
    serversList.innerHTML = '<div class="error">Failed to load servers. Please try again.</div>';
  }
}

function createServerCard(server) {
  const statusClass = server.is_configured ? 'status-configured' : 'status-not-configured';
  const statusText = server.is_configured ? 'Configured' : 'Not Configured';
  
  return `
    <div class="server-card">
      <div class="server-header">
        <img src="${server.icon || 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
             alt="${server.name}" class="server-icon">
        <div class="server-info">
          <h4>${server.name}</h4>
          <p>${server.owner ? 'Owner' : 'Member'}</p>
        </div>
      </div>
      
      <div class="server-status ${statusClass}">${statusText}</div>
      
      <div class="server-actions">
        ${!server.is_configured ? 
          `<button class="btn btn-primary" data-action="configure" data-server-id="${server.id}" data-server-name="${server.name}">
            Configure Server
          </button>` :
          `<button class="btn btn-success" data-action="generate-invite" data-server-id="${server.id}">
            Generate Invite
          </button>
          <button class="btn btn-secondary" data-action="view-stats" data-server-id="${server.id}">
            View Stats
          </button>
          <button class="btn btn-danger" data-action="remove" data-server-id="${server.id}">
            Remove
          </button>`
        }
      </div>
    </div>
  `;
}

function createInviteCard(server) {
  return `
    <div class="invite-card" id="invite-${server.id}">
      <div class="invite-header">
        <img src="${server.icon || 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
             alt="${server.name}" class="invite-icon">
        <div class="invite-info">
          <h4>${server.name}</h4>
          <p>Free Tier Access</p>
        </div>
      </div>
      
      <div class="invite-url" id="invite-url-${server.id}">
        Click "Generate Invite" to create a link
      </div>
      
      <div class="invite-actions">
        <button class="btn btn-primary" data-action="generate-invite" data-server-id="${server.id}">
          Generate Invite
        </button>
        <button class="btn btn-secondary" data-action="copy-invite" data-server-id="${server.id}">
          Copy Link
        </button>
      </div>
    </div>
  `;
}

async function configureServer(serverId, serverName) {
  console.log('Configuring server:', serverId, serverName);
  
  try {
    console.log('Making API call to:', `/api/servers/${serverId}/configure`);
    console.log('Request body:', JSON.stringify({ serverName: serverName }));
    
    const response = await fetch(`/api/servers/${serverId}/configure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serverName: serverName
      })
    });
    
    console.log('Response received:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Server configured successfully:', result);
    
    // Show success message
    showMessage('Server configured successfully!', 'success');
    
    // Reload servers to show updated status
    loadServers();
    
  } catch (error) {
    console.error('Error configuring server:', error);
    console.error('Error details:', error.message);
    showMessage(`Failed to configure server: ${error.message}`, 'error');
  }
}

async function generateInvite(serverId) {
  console.log('Generating invite for server:', serverId);
  
  try {
    const response = await fetch(`/api/servers/${serverId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Invite generated:', result);
    
    if (result.success) {
      // Update the invite URL display
      const inviteUrlElement = document.getElementById(`invite-url-${serverId}`);
      if (inviteUrlElement) {
        inviteUrlElement.textContent = result.invite_url;
      }
      
      showMessage('Invite link generated successfully!', 'success');
    } else {
      showMessage(result.error || 'Failed to generate invite link.', 'error');
    }
    
  } catch (error) {
    console.error('Error generating invite:', error);
    showMessage('Failed to generate invite link. Please try again.', 'error');
  }
}

async function viewStats(serverId) {
  console.log('Viewing stats for server:', serverId);
  
  try {
    const response = await fetch(`/api/servers/${serverId}/stats`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const stats = await response.json();
    console.log('Server stats:', stats);
    
    // Create a simple stats display
    const statsMessage = `
      <strong>${stats.server_name}</strong><br>
      Members: ${stats.member_count}<br>
      Invite Code: ${stats.invite_code}
    `;
    
    showMessage(statsMessage, 'success');
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    showMessage('Failed to load server statistics.', 'error');
  }
}

function copyInvite(serverId) {
  const inviteUrlElement = document.getElementById(`invite-url-${serverId}`);
  if (!inviteUrlElement) return;
  
  const inviteUrl = inviteUrlElement.textContent;
  if (inviteUrl === 'Click "Generate Invite" to create a link') {
    showMessage('Please generate an invite link first.', 'error');
    return;
  }
  
  navigator.clipboard.writeText(inviteUrl).then(() => {
    showMessage('Invite link copied to clipboard!', 'success');
  }).catch(err => {
    console.error('Failed to copy invite link:', err);
    showMessage('Failed to copy invite link.', 'error');
  });
}

function addManualServer() {
  console.log('addManualServer function called');
  
  const serverIdInput = document.getElementById('manual-server-id');
  console.log('Server ID input element:', serverIdInput);
  
  if (!serverIdInput) {
    console.error('Server ID input element not found');
    showMessage('Error: Server ID input not found', 'error');
    return;
  }
  
  const serverId = serverIdInput.value.trim();
  console.log('Server ID value:', serverId);
  
  if (!serverId) {
    showMessage('Please enter a Discord Server ID', 'error');
    return;
  }
  
  // Validate server ID format (Discord server IDs are 17-19 digit numbers)
  if (!/^\d{17,19}$/.test(serverId)) {
    showMessage('Invalid Discord Server ID format. Server IDs are 17-19 digit numbers.', 'error');
    return;
  }
  
  console.log('Calling configureServer with:', serverId, 'Manual Server');
  // Configure the server
  configureServer(serverId, 'Manual Server');
}

async function removeServer(serverId) {
  console.log('Removing server:', serverId);
  
  if (!confirm('Are you sure you want to remove this server? This action cannot be undone.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/servers/${serverId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Remove response received:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Server removed successfully:', result);
    
    // Show success message
    showMessage('Server removed successfully!', 'success');
    
    // Reload servers to show updated status
    loadServers();
    
  } catch (error) {
    console.error('Error removing server:', error);
    console.error('Error details:', error.message);
    showMessage(`Failed to remove server: ${error.message}`, 'error');
  }
}

function addServerActionListeners() {
  const serversList = document.getElementById('servers-list');
  if (!serversList) return;
  
  serversList.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    
    const action = button.dataset.action;
    const serverId = button.dataset.serverId;
    const serverName = button.dataset.serverName;
    
    console.log('Server action clicked:', action, serverId, serverName);
    
    switch (action) {
      case 'configure':
        configureServer(serverId, serverName);
        break;
      case 'generate-invite':
        generateInvite(serverId);
        break;
      case 'view-stats':
        viewStats(serverId);
        break;
      case 'remove':
        removeServer(serverId);
        break;
    }
  });
}

function addInviteActionListeners() {
  const inviteLinks = document.getElementById('invite-links');
  if (!inviteLinks) return;
  
  inviteLinks.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    
    const action = button.dataset.action;
    const serverId = button.dataset.serverId;
    
    console.log('Invite action clicked:', action, serverId);
    
    switch (action) {
      case 'generate-invite':
        generateInvite(serverId);
        break;
      case 'copy-invite':
        copyInvite(serverId);
        break;
    }
  });
}

function showMessage(message, type) {
  // Remove any existing messages
  const existingMessages = document.querySelectorAll('.message');
  existingMessages.forEach(msg => msg.remove());
  
  // Create new message
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.innerHTML = message;
  
  // Insert at the top of the dashboard content
  const dashboardContent = document.querySelector('.dashboard-content');
  if (dashboardContent) {
    dashboardContent.insertBefore(messageDiv, dashboardContent.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
  }
}