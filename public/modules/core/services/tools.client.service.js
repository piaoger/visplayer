'use strict';

//Tool service used for managing  tools
angular.module('core').service('Tools', [

  function() {
    // Define a set of default roles
    this.defaultRoles = ['*'];

    // Define the tools object
    this.tools = {};

    // A private function for rendering decision 
    var shouldRender = function(user) {
      if (user) {
        if (!!~this.roles.indexOf('*')) {
          return true;
        } else {
          for (var userRoleIndex in user.roles) {
            for (var roleIndex in this.roles) {
              if (this.roles[roleIndex] === user.roles[userRoleIndex]) {
                return true;
              }
            }
          }
        }
      } else {
        return this.isPublic;
      }

      return false;
    };

    // Validate tool existance
    this.validateToolExistance = function(toolId) {
      if (toolId && toolId.length) {
        if (this.tools[toolId]) {
          return true;
        } else {
          throw new Error('Tool does not exists');
        }
      } else {
        throw new Error('ToolId was not provided');
      }

      return false;
    };

    // Get the tool object by tool id
    this.getTool = function(toolId) {
      // Validate that the tool exists
      this.validateToolExistance(toolId);

      // Return the tool object
      return this.tools[toolId];
    };

    // Add new tool object by tool id
    this.addTool = function(toolId, isPublic, roles) {
      // Create the new tool
      this.tools[toolId] = {
        isPublic: isPublic || false,
        roles: roles || this.defaultRoles,
        items: [],
        shouldRender: shouldRender
      };

      // Return the tool object
      return this.tools[toolId];
    };

    // Remove existing tool object by tool id
    this.removeTool = function(toolId) {
      // Validate that the tool exists
      this.validateToolExistance(toolId);

      // Return the tool object
      delete this.tools[toolId];
    };

    // Add tool item object
    this.addToolItem = function(toolId, toolItemTitle, toolItemIcon, toolItemURL, toolItemAction, isPublic, roles, position) {
      // Validate that the tool exists
      this.validateToolExistance(toolId);

      // Push new tool item
      this.tools[toolId].items.push({
        title: toolItemTitle,
        icon: toolItemIcon,
        link: toolItemURL || toolItemAction,
        uiRoute: '/' + toolItemURL,
        action: toolItemAction,
        isPublic: ((isPublic === null || typeof isPublic === 'undefined') ? this.tools[toolId].isPublic : isPublic),
        roles: ((roles === null || typeof roles === 'undefined') ? this.tools[toolId].roles : roles),
        position: position || 0,
        items: [],
        shouldRender: shouldRender
      });

      // Return the tool object
      return this.tools[toolId];
    };

    // Remove existing tool object by tool id
    this.removeToolItem = function(toolId, toolItemURL) {
      // Validate that the tool exists
      this.validateToolExistance(toolId);

      // Search for tool item to remove
      for (var itemIndex in this.tools[toolId].items) {
        if (this.tools[toolId].items[itemIndex].link === toolItemURL) {
          this.tools[toolId].items.splice(itemIndex, 1);
        }
      }

      // Return the tool object
      return this.tools[toolId];
    };

    //Adding the sidebar tool
    this.addTool('sidebar');
    this.addTool('panel');
  }
]);
