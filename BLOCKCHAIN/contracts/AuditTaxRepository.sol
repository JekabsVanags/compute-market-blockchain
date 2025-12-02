// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract AuditTaxRepository {
  uint256 public totalCollected;
  address public owner;
  mapping(address => bool) public authorizedRequest;

  constructor() payable {
    owner = msg.sender;
    totalCollected = msg.value;
  }

  modifier onlyOwner() {
      require(msg.sender == owner, "not owner");
      _;
  }

  receive() external payable {
      totalCollected += msg.value;
  }

  function authorizeRequest(address req, bool allowed) external onlyOwner {
      authorizedRequest[req] = allowed;
  }

  //The audit isnt called till this holds more or equal to the funds required
  function withdraw(address payable to, uint256 amount) external {
    require(authorizedRequest[msg.sender], "request not authorized");
    require(amount <= totalCollected, "Insufficient collected tax");

    // update accounting before external call to avoid reentrancy issues
    totalCollected -= amount;

    (bool success, ) = to.call{value: amount}("");
    require(success, "Transfer failed");
  }
}
