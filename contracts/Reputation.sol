pragma solidity ^0.8.28;

contract Reputation {
    address public owner;
    mapping(address => bool) public isBuyer;
    mapping(address => int256) private reputation;

    event BuyerSet(address indexed account, bool allowed);
    event ReputationChanged(address indexed who, address indexed by, int256 delta, int256 newScore);
    event ScoreSet(address indexed who, address indexed by, int256 oldScore, int256 newScore);

    // Modifikators, lai aizsargātu īpašnieka/administratora funkcijas
    modifier onlyAdmin() {
        require(msg.sender == owner, "owner only");
        _;
    }
    // Modifikators, kas ļauj veikt izmaiņas tikai reģistrētiem apliecinātājiem (automātiskā sistēma, pircējs, pārdevējs u.c.)
    modifier onlyBuyer() {
        require(isBuyer[msg.sender], "buyer only");
        _;
    }
    // Modifikators, kas ļauj veikt izmaiņas vai nu īpašniekam, vai apliecinātājam
    modifier byAdminOrBuyer() {
        require(msg.sender == owner || isBuyer[msg.sender], "admin or attester only");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // --- Reputācijas izmaiņas, ko veic Buyers (vai Admin) ---

    // Atļaujam gan adminam, gan apliecinātājiem piešķirt punktus
    function award(address who) external byAdminOrBuyer {
        reputation[who] += 1;
        emit ReputationChanged(who, msg.sender, 1, reputation[who]);
    }

    // Atļaujam gan adminam, gan apliecinātājiem sodīt
    function penalize(address who) external byAdminOrBuyer {
        reputation[who] -= 1;
        emit ReputationChanged(who, msg.sender, -1, reputation[who]);
    }

    // --- Admina/Īpašnieka (Administrative) funkcijas ---

    // Admina funkcija: iestata apliecinātāju
    function setBuyer(address account, bool allowed) external onlyAdmin() {
        isBuyer[account] = allowed;
        emit BuyerSet(account, allowed);
    }

    //Admina funkcija: tieši iestata adreses rezultātu (ārkārtas labojumiem)
    function setScore(address who, int256 newScore) external onlyAdmin {
        int256 oldScore = reputation[who];
        reputation[who] = newScore;
        emit ScoreSet(who, msg.sender, oldScore, newScore);
    }

    // Admina funkcija: migrē īpašumtiesības
    function setAdmin(address newOwner) external onlyAdmin {
        owner = newOwner;
    }

    // --- Lasīšanas (Read) funkcija ---
    
    function reputationOf(address who) external view returns (int256) {
        return reputation[who];
    }
}