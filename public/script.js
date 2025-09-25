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
  
  if (!serversList) return;
  
  serversList.innerHTML = '<div class="loading">Loading your servers...</div>';
  
  try {
    const response = await fetch('/api/servers');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const responseData = await response.json();
    console.log('Loaded servers response:', responseData);
    
    // Handle setup_required message
    if (responseData.setup_required) {
      // Show server addition interface
      const serverAdditionInterface = `
        <div class="server-addition-card">
          <div class="add-server-header">
            <h4>Add Discord Server</h4>
            <span class="discord-id">ID: ${responseData.discord_user_id}</span>
          </div>
          <div class="server-input-section">
            <input type="text" id="manual-server-id" placeholder="Enter Discord Server ID" class="server-id-input">
            <button class="btn btn-primary" id="add-server-btn">Add Server</button>
          </div>
          <div class="help-text">
            <small>💡 Right-click server name in Discord → "Copy Server ID"</small>
          </div>
        </div>
      `;
      
      // Show configured servers if any
      let configuredServersHtml = '';
      if (responseData.configured_servers && responseData.configured_servers.length > 0) {
        configuredServersHtml = `
          ${responseData.configured_servers.map(server => createServerCard({
            id: server.discord_server_id,
            name: server.server_name,
            icon: server.server_icon,
            server_icon: server.server_icon,
            user_role: server.user_role,
            owner: true,
            permissions: 0,
            invite_code: server.invite_code,
            owner_discord_id: server.owner_discord_id,
            is_configured: true,
            created_at: server.created_at
          })).join('')}
        `;
      }
      
      serversList.innerHTML = serverAdditionInterface + configuredServersHtml;
      
      // Add event listener to the add server button
      const addServerBtn = document.getElementById('add-server-btn');
      if (addServerBtn) {
        addServerBtn.addEventListener('click', addManualServer);
      }
      
      // Add event listeners for server action buttons
      addServerActionListeners();
      
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
    
  } catch (error) {
    console.error('Error loading servers:', error);
    serversList.innerHTML = '<div class="error">Failed to load servers. Please try again.</div>';
  }
}

function createServerCard(server) {
  const statusClass = server.is_configured ? 'status-configured' : 'status-not-configured';
  const statusText = server.is_configured ? 'Configured' : 'Not Configured';
  
  return `
    <div class="server-card" data-server-id="${server.id}">
      <div class="server-header">
        <img src="${server.server_icon || server.icon || 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
             alt="${server.name}" class="server-icon">
        <div class="server-info">
          <h4>${server.name}</h4>
          <p>${server.user_role || 'Member'}</p>
        </div>
      </div>
      
      <div class="server-status ${statusClass}">${statusText}</div>
      
      <div class="invite-url-display">
        <label>Your Permanent Invite Link:</label>
        <div class="invite-url-container">
          <input type="text" class="invite-url-input" value="${window.location.origin}/invite/${server.invite_code || 'setup-required'}?affiliate=${server.owner_discord_id || 'unknown'}" readonly>
          <button class="btn btn-copy" data-action="copy-invite" data-server-id="${server.id}">Copy</button>
        </div>
        <div class="help-text">
          <p><small>💡 <strong>This is your permanent invite link.</strong> Share it anywhere - it will never change and always track your referrals.</small></p>
        </div>
      </div>
      
      <div class="server-stats">
        <div class="stat-item">
          <span class="stat-label">Total Invite Clicks:</span>
          <span class="stat-value">${server.total_invite_clicks || 0}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Joins:</span>
          <span class="stat-value">${server.total_joins || 0}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Conversion Rate:</span>
          <span class="stat-value">${server.conversion_rate || '0%'}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Monthly Revenue:</span>
          <span class="stat-value">$${server.monthly_revenue || '0.00'}</span>
        </div>
      </div>
      
      <div class="server-actions">
        ${!server.is_configured ? 
          `<button class="btn btn-primary" data-action="configure" data-server-id="${server.id}" data-server-name="${server.name}">
            Configure Server
          </button>` :
          `<button class="btn btn-danger" data-action="remove" data-server-id="${server.id}">
            Remove Server
          </button>`
        }
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

function copyInvite(serverId) {
  // Find the input field within the server card
  const serverCard = document.querySelector(`[data-server-id="${serverId}"]`);
  if (!serverCard) return;
  
  const inviteInput = serverCard.querySelector('.invite-url-input');
  if (!inviteInput) return;
  
  const inviteUrl = inviteInput.value;
  if (inviteUrl.endsWith('/invite/setup-required?affiliate=unknown')) {
    showMessage('Please configure your server first.', 'error');
    return;
  }
  
  navigator.clipboard.writeText(inviteUrl).then(() => {
    showMessage('Permanent invite link copied to clipboard!', 'success');
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
  if (!serversList) {
    console.error('servers-list element not found');
    return;
  }
  
  console.log('Adding server action listeners to:', serversList);
  
  serversList.addEventListener('click', (e) => {
    console.log('Click detected on:', e.target);
    const button = e.target.closest('[data-action]');
    console.log('Closest button with data-action:', button);
    
    if (!button) {
      console.log('No button with data-action found');
      return;
    }
    
    const action = button.dataset.action;
    const serverId = button.dataset.serverId;
    const serverName = button.dataset.serverName;
    
    console.log('Server action clicked:', action, serverId, serverName);
    
    switch (action) {
      case 'configure':
        configureServer(serverId, serverName);
        break;
        case 'remove':
          removeServer(serverId);
          break;
        case 'copy-invite':
          copyInvite(serverId);
          break;
      default:
        console.log('Unknown action:', action);
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