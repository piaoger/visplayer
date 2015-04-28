'use strict';

//Tree service used for managing  trees
angular.module('core').service('Trees', ['$log',

  function($log) {
    // Define a set of default roles
    this.defaultRoles = ['*'];

    // Define the trees object
    this.trees = {};

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

    // Validate tree existance
    this.validateTreeExistance = function(treeId) {
      if (treeId && treeId.length) {
        if (!this.trees[treeId]) {
          $log.error('Tree does not exists');
          return false;
        }
      }
      return true;
    };

    // Get the tree object by tree id
    this.getTree = function(treeId) {
      // Validate that the tree exists
      if(!this.validateTreeExistance(treeId)) {
        return;
      }

      // Return the tree object
      return this.trees[treeId];
    };

    // Add new tree object by tree id
    this.addTree = function(treeId, isPublic, roles) {
      // Create the new tree
      this.trees[treeId] = {
        isPublic: isPublic || false,
        roles: roles || this.defaultRoles,
        items: [],
        shouldRender: shouldRender
      };

      // Return the tree object
      return this.trees[treeId];
    };

    // Empty existing tree objects
    this.emptyTree = function(treeId) {
      // Validate that the tree exists
      if(!this.validateTreeExistance(treeId)) {
        return;
      }

      // Search for tree item to remove
      for (var itemIndex in this.trees[treeId].items) {
        this.trees[treeId].items[itemIndex].items = [];
      }
    };

    // Remove existing tree object by tree id
    this.removeTree = function(treeId) {
      // Validate that the tree exists
      if(!this.validateTreeExistance(treeId)) {
        return;
      }

      // Return the tree object
      delete this.trees[treeId];
    };

    // Validate tree item existance
    this.validateTreeItemExistance = function(treeId, treeItemURL) {
      if (treeItemURL && treeItemURL.length) {
        for (var itemIndex in this.trees[treeId].items) {
          if (this.trees[treeId].items[itemIndex].link === treeItemURL) {
            $log.error('Tree item is already existant');
            return false;
          }
        }
      }
      return true;
    };

    // Add tree item object
    this.addTreeItem = function(treeId, treeItemTitle, treeItemIcon, treeItemURL, isPublic, roles) {
      // Validate that the tree exists
      if(!this.validateTreeExistance(treeId)) {
        return;
      }

      // Validate that the tree item exists
      if(!this.validateTreeItemExistance(treeId, treeItemURL)) {
        return;
      }

      // Push new tree item
      this.trees[treeId].items.push({
        title: treeItemTitle,
        icon: treeItemIcon,
        link: treeItemURL,
        isPublic: ((isPublic === null || typeof isPublic === 'undefined') ? this.trees[treeId].isPublic : isPublic),
        roles: ((roles === null || typeof roles === 'undefined') ? this.trees[treeId].roles : roles),
        items: [],
        checked: false,
        shouldRender: shouldRender
      });

      // Return the tree object
      return this.trees[treeId];
    };

    // Remove existing tree object by tree id
    this.removeTreeItem = function(treeId, treeItemURL) {
      // Validate that the tree exists
      if(!this.validateTreeExistance(treeId)) {
        return;
      }

      // Search for tree item to remove
      for (var itemIndex in this.trees[treeId].items) {
        if (this.trees[treeId].items[itemIndex].link === treeItemURL) {
          this.trees[treeId].items.splice(itemIndex, 1);
        }
      }

      // Return the tree object
      return this.trees[treeId];
    };

    // Validate tree item existance
    this.validateSubTreeItemExistance = function(treeId, rootTreeItemURL, subtreeItemURL) {
      if (subtreeItemURL && subtreeItemURL.length) {
        for (var itemIndex in this.trees[treeId].items) {
          if (this.trees[treeId].items[itemIndex].link === rootTreeItemURL) {
            for (var subitemIndex in this.trees[treeId].items[itemIndex].items) {
              if (this.trees[treeId].items[itemIndex].items[subitemIndex].link === subtreeItemURL) {
                $log.error('Sub tree item is already existant');
                return false;
              }
            }
          }
        }
      }
      return true;
    };

    // Add subtree item object
    this.addSubTreeItem = function(treeId, rootTreeItemURL, treeItemTitle, treeItemIcon, treeItemURL, isPublic, roles) {
      // Validate that the tree exists
      if(!this.validateTreeExistance(treeId)) {
        return;
      }

      // Validate that the tree item exists
      if(!this.validateTreeItemExistance(treeId, treeItemURL)) {
        return;
      }

      // Validate that the tree exists
      if(!this.validateSubTreeItemExistance(treeId, rootTreeItemURL, treeItemURL)) {
        return;
      }

      // Search for tree item
      for (var itemIndex in this.trees[treeId].items) {
        if (this.trees[treeId].items[itemIndex].link === rootTreeItemURL) {
          // Push new subtree item
          this.trees[treeId].items[itemIndex].items.push({
            title: treeItemTitle,
            icon: treeItemIcon,
            link: treeItemURL,
            isPublic: ((isPublic === null || typeof isPublic === 'undefined') ? this.trees[treeId].items[itemIndex].isPublic : isPublic),
            roles: ((roles === null || typeof roles === 'undefined') ? this.trees[treeId].items[itemIndex].roles : roles),
            checked: false,
            shouldRender: shouldRender
          });
        }
      }

      // Return the tree object
      return this.trees[treeId];
    };

    // Remove existing tree object by tree id
    this.removeSubTreeItem = function(treeId, subtreeItemURL) {
      // Validate that the tree exists
      if(!this.validateTreeExistance(treeId)) {
        return;
      }

      // Search for tree item to remove
      for (var itemIndex in this.trees[treeId].items) {
        for (var subitemIndex in this.trees[treeId].items[itemIndex].items) {
          if (this.trees[treeId].items[itemIndex].items[subitemIndex].link === subtreeItemURL) {
            this.trees[treeId].items[itemIndex].items.splice(subitemIndex, 1);
          }
        }
      }

      // Return the tree object
      return this.trees[treeId];
    };

    // Select subtree items
    this.checkAllSubTreeItems = function(treeId, rootTreeItemURL, checked) {
      // Validate that the tree exists
      if(!this.validateTreeExistance(treeId)) {
        return;
      }

      // Search for subtree items
      for (var itemIndex in this.trees[treeId].items) {
        if (this.trees[treeId].items[itemIndex].link === rootTreeItemURL) {
          var item = this.trees[treeId].items[itemIndex];
          if (angular.isDefined(item.items) && item.items.length > 0) {
            for (var subitemIndex in item.items) {
              item.items[subitemIndex].checked = checked;
            }
          }
        }
      }
    };

    // Get checked tree object
    this.getCheckedSubTreeItems = function(treeId) {
      // Validate that the tree exists
      if(!this.validateTreeExistance(treeId)) {
        return;
      }

      // Search for tree item to remove
      var items = [];
      for (var itemIndex in this.trees[treeId].items) {
        for (var subitemIndex in this.trees[treeId].items[itemIndex].items) {
          if (this.trees[treeId].items[itemIndex].items[subitemIndex].checked === true) {
            items.push(this.trees[treeId].items[itemIndex].items[subitemIndex]);
          }
        }
      }

      // Return the tree object
      return items;
    };
  }
]);
