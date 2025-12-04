using UnityEngine;
using System.Collections;

public class DiceRole : MonoBehaviour
{
    [Header("Dice Sides")]
    public GameObject[] sides; // Assign SideOne–SideSix in order in the Inspector

    [Header("Animation Settings")]
    public float rollTime = 1.5f;   // Total duration of rolling
    public float switchSpeed = 0.1f; // Time between side flashes
    public float bounceHeight = 0.2f; // Little visual bounce amount

    private bool isRolling = false;
    private Vector3 startPosition;

    void Start()
    {
        startPosition = transform.localPosition;
        ShowSide(1); // ✅ Default to Side One at start
    }

    public void RollDice(int result)
    {
        if (!isRolling)
            StartCoroutine(RollAnimation(result));
    }

    private IEnumerator RollAnimation(int result)
    {
        isRolling = true;
        float elapsed = 0f;

        while (elapsed < rollTime)
        {
            // Randomly show sides while "rolling"
            ShowRandomSide();

            // Bounce effect
            float bounce = Mathf.Sin(elapsed * 10f) * bounceHeight;
            transform.localPosition = startPosition + new Vector3(0, bounce, 0);

            elapsed += switchSpeed;
            yield return new WaitForSeconds(switchSpeed);
        }

        // Return to base position and show the final result
        transform.localPosition = startPosition;
        ShowSide(result);

        isRolling = false;
    }

    private void ShowRandomSide()
    {
        int randomIndex = Random.Range(0, sides.Length);
        for (int i = 0; i < sides.Length; i++)
        {
            sides[i].SetActive(i == randomIndex);
        }
    }

    private void ShowSide(int number)
    {
        // Assuming sides are ordered 1–6 in the Inspector
        for (int i = 0; i < sides.Length; i++)
        {
            sides[i].SetActive(i == number - 1);
        }
    }
}
